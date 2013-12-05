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
WebCLGLKernel = function(gl, length, offset, source, header) { 
	this.gl = gl;
	this.W = Math.sqrt(length);
	this.H = this.W;
	this.offset = offset; 
	
	var highPrecisionSupport = this.gl.getShaderPrecisionFormat(this.gl.FRAGMENT_SHADER, this.gl.HIGH_FLOAT);
	this.precision = (highPrecisionSupport != 0) ? 'precision highp float;\n\n' : 'precision mediump float;\n\n';
	
	this.ready = false;
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
	var argumentsSource = source.split(')')[0].split('(')[1].split(','); // "float* A","float* B"
	//console.log(argumentsSource);
	for(var n = 0, f = argumentsSource.length; n < f; n++) {
		if(argumentsSource[n].match(/\*/gm) != null) {
			this.in_values[n] = {value:undefined,
								type:'buffer',
								name:argumentsSource[n].split('*')[1].trim()};
		} else {
			this.in_values[n] = {value:undefined,
								type:'float',
								name:argumentsSource[n].split(' ')[1].trim()};
		}
	}
	//console.log(this.in_values);
	
	this.source = source.split('}')[0].split('{')[1];
	this.source = source.replace(/^.*{/gi, '').replace(/}$/gi, '');
	//console.log(this.source);
	for(var n = 0, f = this.in_values.length; n < f; n++) {
		var regexp = new RegExp(this.in_values[n].name+'\\[\\w*\\]',"gm"); // "A[x]","B[x]"
		var varMatches = this.source.match(regexp);
		if(varMatches != null) {
			for(var nB = 0, fB = varMatches.length; nB < fB; nB++) {
				var regexp = new RegExp('\\W'+this.in_values[n].name+'\\[\\w*\\]',"gm");
				if(varMatches[nB].match(regexp) == null) {
					var name = varMatches[nB].split('[')[0];
					var vari = varMatches[nB].split('[')[1].split(']')[0];
					var regexp = new RegExp(name+'\\['+vari+'\\]',"gm");
					this.source = this.source.replace(regexp, 'in_data('+name+','+vari+')');
				}
			}
		}
	}
	//console.log(this.source);
};

/**
* Bind float or a WebCLGLBuffer to a kernel argument
* @type Void
* @param {Int} numArgument
* @param {Float WebCLGLBuffer} data
*/
WebCLGLKernel.prototype.setKernelArg = function(numArgument, data) {
	this.in_values[numArgument].value = data;
	
	if(this.ready == true) this.generateUniforms(); 
};

/**
* Check if kernel is ready
* @returns {Bool}
*/
WebCLGLKernel.prototype.isReady = function() {
	if(this.ready == false) return this.compile();
	else return true;
};

/**
 * @private 
 */
WebCLGLKernel.prototype.compile = function() {
	this.ready = false;
	
	var readyToCompile = true;
	for(var n = 0, f = this.in_values.length; n < f; n++) {
		if(this.in_values[n].value == undefined) {
			readyToCompile = false; break;
		}
	}
	if(readyToCompile == true) { 
		lines_uniforms = function(in_values) {
			str = '';
			for(var n = 0, f = in_values.length; n < f; n++) {
				if(in_values[n].type == 'buffer') {
					str += 'uniform sampler2D '+in_values[n].name+';\n';
				} else {
					str += 'uniform float '+in_values[n].name+';\n';
				}
			}
			return str;
		};
		lines_in_data = function(offset) {
			str = 'vec4 textureColor = texture2D(arg, coord);\n';
			if(offset>0.0) str += 'return (unpack(textureColor)*'+parseFloat(offset*2.0).toFixed(1)+')-'+parseFloat(offset).toFixed(1)+';\n';
			else str += 'return unpack(textureColor);\n';
			return str;
		};
		lines_out_data = function(offset) {
			if(offset>0.0) return 'gl_FragColor = pack((out_data+'+parseFloat(offset).toFixed(1)+')/'+parseFloat(offset*2.0).toFixed(1)+');\n';
			else return 'gl_FragColor = pack(out_data);\n';
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
			
			'vec4 pack(float depth) {\n'+
				'const vec4 bias = vec4(1.0 / 255.0,\n'+
							'1.0 / 255.0,\n'+
							'1.0 / 255.0,\n'+
							'0.0);\n'+

				'float r = depth;\n'+
				'float g = fract(r * 255.0);\n'+
				'float b = fract(g * 255.0);\n'+
				'float a = fract(b * 255.0);\n'+
				'vec4 colour = vec4(r, g, b, a);\n'+
				
				'return colour - (colour.yzww * bias);\n'+
			'}\n'+
			'float unpack (vec4 colour) {\n'+
				'const vec4 bitShifts = vec4(1.0,\n'+
								'1.0 / 255.0,\n'+
								'1.0 / (255.0 * 255.0),\n'+
								'1.0 / (255.0 * 255.0 * 255.0));\n'+
				'return dot(colour, bitShifts);\n'+
			'}\n'+
			'float in_data(sampler2D arg, vec2 coord) {\n'+
				lines_in_data(this.offset)+
			'}\n'+
			'vec2 get_global_id() {\n'+
				'return global_id;\n'+
			'}\n'+
			this.head+
			'void main(void) {\n'+
				
				
				this.source+  
				lines_out_data(this.offset)+
				 
			'}\n';
		this.kernel = this.gl.createProgram();
		//console.log(sourceFragment);
		this.createShader("WEBCLGL", sourceVertex, sourceFragment, this.kernel);
		
		this.generateUniforms();
		
		this.attr_VertexPos = this.gl.getAttribLocation(this.kernel, "aVertexPosition");
		this.attr_TextureCoord = this.gl.getAttribLocation(this.kernel, "aTextureCoord");
		
		this.ready = true;
		return true;
	} else {
		return false;
	}
};
/**
 * @private 
 */
WebCLGLKernel.prototype.generateUniforms = function() {
	this.samplers = [];
	this.uniformsFloat = [];
	for(var n = 0, f = this.in_values.length; n < f; n++) {
		if(this.in_values[n].type == 'buffer') {
			this.samplers.push({location:this.gl.getUniformLocation(this.kernel, this.in_values[n].name),value:this.in_values[n].value});
		} else {
			this.uniformsFloat.push({location:this.gl.getUniformLocation(this.kernel, this.in_values[n].name),value:this.in_values[n].value});
		}
	}
};
/**
 * @private 
 */
WebCLGLKernel.prototype.createShader = function(name, sourceVertex, sourceFragment, shaderProgram) {
	var shaderVertex = this.gl.createShader(this.gl.VERTEX_SHADER);
	this.gl.shaderSource(shaderVertex, sourceVertex);
	this.gl.compileShader(shaderVertex);
	if (!this.gl.getShaderParameter(shaderVertex, this.gl.COMPILE_STATUS)) {
		alert('Error sourceVertex of shader '+name+'. See console.');
		console.log('Error vertex-shader '+name+':\n '+this.gl.getShaderInfoLog(shaderVertex));
	}
	
	var shaderFragment = this.gl.createShader(this.gl.FRAGMENT_SHADER);
	this.gl.shaderSource(shaderFragment, sourceFragment);
	this.gl.compileShader(shaderFragment);
	if (!this.gl.getShaderParameter(shaderFragment, this.gl.COMPILE_STATUS)) {
		alert('Error sourceFragment of shader '+name+'. See console.');
		console.log('Error fragment-shader '+name+':\n '+this.gl.getShaderInfoLog(shaderFragment));
	}
	
		
	this.gl.attachShader(shaderProgram, shaderVertex);
	this.gl.attachShader(shaderProgram, shaderFragment);	
	this.gl.linkProgram(shaderProgram);
	if (!this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS)) alert('Error in shader '+name);
};

