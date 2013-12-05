/*
The MIT License (MIT)

Copyright (c) <2013> <Roberto Gonzalez. http://stormcolour.appspot.com/>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.  
 */ 
 
/** 
* WebCLGLKernel Object
* @class
* @constructor
*/
WebCLGLKernel = function(gl, source, header) { 
	this.gl = gl;
	var highPrecisionSupport = this.gl.getShaderPrecisionFormat(this.gl.FRAGMENT_SHADER, this.gl.HIGH_FLOAT);
	this.precision = (highPrecisionSupport != 0) ? 'precision highp float;\n\n' : 'precision mediump float;\n\n';
	
	this.utils = new WebCLGLUtils(this.gl);
	
	this.ready = false;
	
	this.in_values = []; //{value,type,name,idPointer} 
	// type: 'buffer', 'buffer4' or 'float' (sampler R, sampler RGBA or uniform1f) 
	// idPointer to: this.samplers or this.uniformsFloat (according to type)
	
	this.samplers = []; // {location,value}
	this.uniformsFloat = []; // {location,value}
	if(source != undefined) this.setKernelSource(source, header); 
};

/**
* Update the kernel source 
* @type Void
* @param {String} source
* @param {String} header Additional functions
*/
WebCLGLKernel.prototype.setKernelSource = function(source, header) {
	this.head =(header!=undefined)?header:''; 
	this.in_values = [];
	var argumentsSource = source.split(')')[0].split('(')[1].split(','); // "float* A","float* B", "float C", "float4* D"
	//console.log(argumentsSource);
	for(var n = 0, f = argumentsSource.length; n < f; n++) {
		if(argumentsSource[n].match(/\*/gm) != null) {
			if(argumentsSource[n].match(/float4/gm) != null) {
				this.in_values[n] = {value:undefined,
									type:'buffer4',
									name:argumentsSource[n].split('*')[1].trim()};
			} else {
				this.in_values[n] = {value:undefined,
									type:'buffer',
									name:argumentsSource[n].split('*')[1].trim()};
			}
		} else {
			this.in_values[n] = {value:undefined,
								type:'float',
								name:argumentsSource[n].split(' ')[1].trim()};
		}
	}
	//console.log(this.in_values);
	
	//console.log('normal'+source);
	this.source = source.replace(/\r\n/gi, '').replace(/\r/gi, '').replace(/\n/gi, '');
	this.source = this.source.replace(/^\w* \w*\([\w\s\*,]*\) {/gi, '').replace(/}\W*$/gi, '');
	//console.log('llaves'+this.source);
	this.source = this.parse(this.source);
};
/**
* @private 
*/
WebCLGLKernel.prototype.parse = function(source) {
	//console.log(source);
	for(var n = 0, f = this.in_values.length; n < f; n++) { // for each in_values (in argument)
		var regexp = new RegExp(this.in_values[n].name+'\\[\\w*\\]',"gm"); 
		var varMatches = source.match(regexp);// "Search current "in_values.name[xxx]" in source and store in array varMatches
		//console.log(varMatches);
		if(varMatches != null) {
			for(var nB = 0, fB = varMatches.length; nB < fB; nB++) { // for each varMatches ("A[x]", "A[x]")
				var name = varMatches[nB].split('[')[0];
				var vari = varMatches[nB].split('[')[1].split(']')[0];
				var regexp = new RegExp(name+'\\['+vari.trim()+'\\]',"gm");
				if(this.in_values[n].type == 'buffer') 
					source = source.replace(regexp, 'in_data('+name+','+vari+')');
				else if(this.in_values[n].type == 'buffer4') 
					source = source.replace(regexp, 'in_data4('+name+','+vari+')');
			}
		}
	}
	//console.log(this.source);
	return source;
};
/**
* Bind float or a WebCLGLBuffer to a kernel argument
* @type Void
* @param {Int} numArgument
* @param {Float|WebCLGLBuffer} data
*/
WebCLGLKernel.prototype.setKernelArg = function(numArgument, data) {
	var isNewArg = (this.in_values[numArgument] == undefined || this.in_values[numArgument].value == undefined) ? true : false;
	this.in_values[numArgument].value = data;
	if(isNewArg) {
		//this.updatePointers();
	} else { 
		if(this.in_values[numArgument].type == 'buffer' || this.in_values[numArgument].type == 'buffer4') {
			this.samplers[this.in_values[numArgument].idPointer].value = this.in_values[numArgument].value;
		} else if(this.in_values[numArgument].type == 'float') {
			this.uniformsFloat[this.in_values[numArgument].idPointer].value = this.in_values[numArgument].value;
		}
	}
};

/**
* Check if kernel is compilable
* @returns {Bool}
* @private 
*/
WebCLGLKernel.prototype.isCompilable = function() {
	for(var n = 0, f = this.in_values.length; n < f; n++)
		if(this.in_values[n].value == undefined)
			return false;
	return true;
};
/**
* Check if kernel is ready
* @returns {Bool}
* @private 
*/
WebCLGLKernel.prototype.isReady = function() {
	if(this.ready == true) return true;
	else if(this.isCompilable()) this.compile();
};

/**
* Use this function if you update the source kernel "setKernelSource()" after of the call to enqueueNDRangeKernel
* @type Void
 */
WebCLGLKernel.prototype.compile = function() {
	lines_uniforms = function(in_values) {
		str = '';
		for(var n = 0, f = in_values.length; n < f; n++) {
			if(in_values[n].type == 'buffer' || in_values[n].type == 'buffer4') {
				str += 'uniform sampler2D '+in_values[n].name+';\n';
			} else if(in_values[n].type == 'float') {
				str += 'uniform float '+in_values[n].name+';\n';
			}
		}
		return str;
	};
	var sourceVertex = 	'attribute vec3 aVertexPosition;\n'+
		'attribute vec2 aTextureCoord;\n'+
		
		'varying vec2 global_id;\n'+ 
		
		'void main(void) {\n'+
			'gl_Position = vec4(aVertexPosition, 1.0);\n'+
			'global_id = aTextureCoord;\n'+
		'}\n';
	var sourceFragment = this.precision+
		
		lines_uniforms(this.in_values)+
		
		'varying vec2 global_id;\n'+ 
		
		'float in_data(sampler2D arg, vec2 coord) {\n'+
			'vec4 textureColor = texture2D(arg, coord);\n'+
			'return textureColor.x;\n'+
		'}\n'+
		'vec4 in_data4(sampler2D arg, vec2 coord) {\n'+
			'vec4 textureColor = texture2D(arg, coord);\n'+
			'return textureColor;\n'+
		'}\n'+
		'vec2 get_global_id() {\n'+
			'return global_id;\n'+
		'}\n'+
		this.head+
		'void main(void) {\n'+
			'float out_float = -999.99989;\n'+
			'vec4 out_float4;\n'+
			this.source+  
			
			'if(out_float != -999.99989) gl_FragColor = vec4(out_float,0.0,0.0,1.0);\n'+
			'else gl_FragColor = out_float4;\n'+ 
		'}\n';
	this.kernel = this.gl.createProgram();
	//console.log(sourceFragment);
	this.utils.createShader("WEBCLGL", sourceVertex, sourceFragment, this.kernel);
	
	this.updatePointers();
	
	this.attr_VertexPos = this.gl.getAttribLocation(this.kernel, "aVertexPosition");
	this.attr_TextureCoord = this.gl.getAttribLocation(this.kernel, "aTextureCoord");
	
	this.ready = true;
	return true;
};
/**
 * @private 
 */
WebCLGLKernel.prototype.updatePointers = function() {
	this.samplers = [];
	this.uniformsFloat = [];
	for(var n = 0, f = this.in_values.length; n < f; n++) {
		if(this.in_values[n].type == 'buffer' || this.in_values[n].type == 'buffer4') {
			this.samplers.push({location:this.gl.getUniformLocation(this.kernel, this.in_values[n].name),
								value:this.in_values[n].value});
			this.in_values[n].idPointer = this.samplers.length-1;
		} else if(this.in_values[n].type == 'float') {
			this.uniformsFloat.push({location:this.gl.getUniformLocation(this.kernel, this.in_values[n].name),
									value:this.in_values[n].value});
			this.in_values[n].idPointer = this.uniformsFloat.length-1;
		}
	}
};
