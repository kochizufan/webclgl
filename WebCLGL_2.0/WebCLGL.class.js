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
* Class for parallelization of calculations using the WebGL context similarly to webcl. This library use floating point texture capabilities (OES_texture_float)
* @class
* @constructor
* @param {WebGLRenderingContext} [webglcontext=undefined] your WebGLRenderingContext
*/
WebCLGL = function(webglcontext) { 
	// WEBGL CONTEXT
	this.e = undefined;
	if(webglcontext == undefined) {
		this.e = document.createElement('canvas');
		this.e.width = 32;
		this.e.height = 32;
		try {
			this.gl = this.e.getContext("webgl", {antialias: false});
		} catch(e) {
			this.gl = undefined;
		}
		if(this.gl == undefined) {
			try {
				this.gl = this.e.getContext("experimental-webgl", {antialias: false});
			} catch(e) {
				this.gl = undefined;
			}
		}
	} else this.gl = webglcontext; 
	this.gl.getExtension('OES_texture_float') ? true : false;
	this.gl.getExtension('OES_texture_float_linear') ? true : false;
	var highPrecisionSupport = this.gl.getShaderPrecisionFormat(this.gl.FRAGMENT_SHADER, this.gl.HIGH_FLOAT);
	this.precision = (highPrecisionSupport != 0) ? 'precision highp float;\n\n' : 'precision mediump float;\n\n';
	
	this.gl.viewport(0, 0, 32, 32);  
	this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
	
	this.utils = new WebCLGLUtils(this.gl);
	
	// QUAD
	var mesh = this.utils.loadQuad(undefined,1.0,1.0);
	this.vertexBuffer_QUAD = this.gl.createBuffer();
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer_QUAD);
	this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(mesh.vertexArray), this.gl.STATIC_DRAW);
	this.textureBuffer_QUAD = this.gl.createBuffer();
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureBuffer_QUAD);
	this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(mesh.textureArray), this.gl.STATIC_DRAW);
	this.indexBuffer_QUAD = this.gl.createBuffer();
	this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer_QUAD);
	this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indexArray), this.gl.STATIC_DRAW);
	
	
	
	// SHADER READPIXELS
	var sourceVertex = 	'attribute vec3 aVertexPosition;\n'+
			'attribute vec2 aTextureCoord;\n'+
			
			'varying vec2 vTextureCoord;\n'+ 
			
			'void main(void) {\n'+
				'gl_Position = vec4(aVertexPosition, 1.0);\n'+
				'vTextureCoord = aTextureCoord;\n'+
			'}\n';
	var sourceFragment = this.precision+
			'uniform sampler2D sampler_buffer;\n'+
			
			'uniform int u_vectorValue;\n'+
			'uniform int u_offset;\n'+
			
			'varying vec2 vTextureCoord;\n'+ 
			
			this.utils.packGLSLFunctionString()+ 
			
			'void main(void) {\n'+
				'vec4 tex = texture2D(sampler_buffer, vTextureCoord);'+
				'if(u_offset > 0) {'+
					'float offset = float(u_offset);'+
					'if(u_vectorValue == 0) gl_FragColor = pack((tex.r+offset)/(offset*2.0));\n'+
					'if(u_vectorValue == 1) gl_FragColor = pack((tex.g+offset)/(offset*2.0));\n'+
					'if(u_vectorValue == 2) gl_FragColor = pack((tex.b+offset)/(offset*2.0));\n'+
					'if(u_vectorValue == 3) gl_FragColor = pack((tex.a+offset)/(offset*2.0));\n'+
				'} else {'+
					'if(u_vectorValue == 0) gl_FragColor = pack(tex.r);\n'+
					'if(u_vectorValue == 1) gl_FragColor = pack(tex.g);\n'+
					'if(u_vectorValue == 2) gl_FragColor = pack(tex.b);\n'+
					'if(u_vectorValue == 3) gl_FragColor = pack(tex.a);\n'+
				'}'+				 
			'}\n';
			
	this.shader_readpixels = this.gl.createProgram();
	this.utils.createShader("CLGLREADPIXELS", sourceVertex, sourceFragment, this.shader_readpixels);
			
	this.u_offset = this.gl.getUniformLocation(this.shader_readpixels, "u_offset");
	this.u_vectorValue = this.gl.getUniformLocation(this.shader_readpixels, "u_vectorValue");
	
	this.sampler_buffer = this.gl.getUniformLocation(this.shader_readpixels, "sampler_buffer");
	
	this.attr_VertexPos = this.gl.getAttribLocation(this.shader_readpixels, "aVertexPosition");
	this.attr_TextureCoord = this.gl.getAttribLocation(this.shader_readpixels, "aTextureCoord");
	
	
	
	// SHADER COPYTEXTURE
	var sourceVertex = 	'attribute vec3 aVertexPosition;\n'+
		'attribute vec2 aTextureCoord;\n'+
	
		'varying vec2 vTextureCoord;\n'+ 
		
		'void main(void) {\n'+
			'gl_Position = vec4(aVertexPosition, 1.0);\n'+
			'vTextureCoord = aTextureCoord;\n'+
		'}';
	var sourceFragment = this.precision+
		
		'uniform sampler2D sampler_toSave;\n'+
		
		'varying vec2 vTextureCoord;\n'+ 
		
		'void main(void) {\n'+
			'vec4 texture = texture2D(sampler_toSave, vTextureCoord);\n'+ 
			'gl_FragColor = texture;'+
		'}';
	this.shader_copyTexture = this.gl.createProgram();
	this.utils.createShader("CLGLCOPYTEXTURE", sourceVertex, sourceFragment, this.shader_copyTexture);
	
	this.attr_copyTexture_pos = this.gl.getAttribLocation(this.shader_copyTexture, "aVertexPosition");
	this.attr_copyTexture_tex = this.gl.getAttribLocation(this.shader_copyTexture, "aTextureCoord");
	
	this.sampler_copyTexture_toSave = this.gl.getUniformLocation(this.shader_copyTexture, "sampler_toSave");
};
/**
* Copy one WebCLGLBuffer|WebGLTexture to another WebCLGLBuffer|WebGLTexture.
* @param {WebCLGLBuffer|WebGLTexture} valueToRead The buffer to read.
* @param {WebCLGLBuffer|WebGLTexture} valueToWrite The buffer to write.
* @example
* // This is useful if you need to write about a buffer and also want to read it by passing it as an argument in main().
* // If this is the case, you have to create a temporary buffer for the writing and take the original buffer for the reading:
* kernelA.setKernelArg (x, ORIGINALbuffer);
* webCLGL.enqueueNDRangeKernel (kernelA, TMPbuffer);
* kernelB.setKernelArg (x, ORIGINALbuffer);
* webCLGL.enqueueNDRangeKernel (kernelB, anotherBuffer);
* // Then overwrite the original with the temporary:
* webCLGL.copyTexture (TMPbuffer, ORIGINALbuffer);
*/
WebCLGL.prototype.copy = function(valueToRead, valueToWrite) { 
	if(valueToRead instanceof WebCLGLBuffer) {
		this.gl.viewport(0, 0, valueToWrite.W, valueToWrite.H); 
		this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, valueToWrite.fBuffer); 
		this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, valueToWrite.textureData, 0);
	} else
		this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, valueToWrite, 0);
	
	
	this.gl.useProgram(this.shader_copyTexture);
	
	this.gl.activeTexture(this.gl.TEXTURE0);
	var toRead = (valueToRead instanceof WebGLTexture) ? valueToRead : valueToRead.textureData;
	this.gl.bindTexture(this.gl.TEXTURE_2D, toRead);
	this.gl.uniform1i(this.sampler_copyTexture_toSave, 0);				
	
	
	this.gl.enableVertexAttribArray(this.attr_copyTexture_pos);
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer_QUAD);
	this.gl.vertexAttribPointer(this.attr_copyTexture_pos, 3, this.gl.FLOAT, false, 0, 0);
	
	this.gl.enableVertexAttribArray(this.attr_copyTexture_tex);
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureBuffer_QUAD);
	this.gl.vertexAttribPointer(this.attr_copyTexture_tex, 3, this.gl.FLOAT, false, 0, 0);
	
	this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer_QUAD);
	this.gl.drawElements(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_SHORT, 0);	
};
/**
* Create a empty WebCLGLBuffer 
* @param {Int} length Length of buffer. 
* @param {Array<Float>} length Array with width and height values if is for a WebGLTexture
* @param {String} [type="FLOAT"] type FLOAT or FLOAT4
* @param {Int} [offset=0] If 0 the range is from 0.0 to 1.0 else if >0 then the range is from -offset.0 to offset.0
* @property {Bool} [linear=false] linear texParameteri type for the WebGLTexture
* @returns {WebCLGLBuffer} 
*/
WebCLGL.prototype.createBuffer = function(length, type, offset, linear) {	
	var webclglBuffer = new WebCLGLBuffer(this.gl, length, linear);	  
	if(type != undefined && type == 'FLOAT4') webclglBuffer.type = 'FLOAT4';
	if(offset != undefined) webclglBuffer.offset = offset;   
	
	return webclglBuffer;
};

/**
* Create a kernel
* @returns {WebCLGLKernel} 
* @param {String} [source=undefined]
* @param {String} [header=undefined] Additional functions 
*/
WebCLGL.prototype.createKernel = function(source, header) {  
	var webclglKernel = new WebCLGLKernel(this.gl, source, header);
	return webclglKernel;
};

/**
* Write on buffer
* @type Void
* @param {WebCLGLBuffer} buffer
* @param {Array|Float32Array|Uint8Array|WebGLTexture|HTMLImageElement} array 
* @param {Bool} [flip=false]
*/
WebCLGL.prototype.enqueueWriteBuffer = function(buffer, arr, flip) {	
	buffer.inData = arr;
	if(arr instanceof WebGLTexture) buffer.textureData = arr;
	else {
		if(flip == false || flip == undefined) 
			this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);
		else 
			this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);  
		this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); 
		this.gl.bindTexture(this.gl.TEXTURE_2D, buffer.textureData);
		if(arr instanceof HTMLImageElement)  {
			buffer.inData = this.utils.getUint8ArrayFromHTMLImageElement(arr);
			this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.FLOAT, arr);
		} else {
			if(buffer.type == 'FLOAT4') {
				if(arr instanceof Uint8Array)  
					this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, buffer.W, buffer.H, 0, this.gl.RGBA, this.gl.FLOAT, new Float32Array(arr));
				else if(arr instanceof Float32Array) 
					this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, buffer.W, buffer.H, 0, this.gl.RGBA, this.gl.FLOAT, arr);
				else 
					this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, buffer.W, buffer.H, 0, this.gl.RGBA, this.gl.FLOAT, new Float32Array(arr));
			} else if(buffer.type == 'FLOAT') {
				var arrayTemp = new Float32Array(arr.length*4); 
				for(var n = 0, f = arr.length; n < f; n++) {
					var idd = n*4;
					arrayTemp[idd] = arr[n];   
					arrayTemp[idd+1] = 0.0;
					arrayTemp[idd+2] = 0.0;
					arrayTemp[idd+3] = 0.0; 
				}
				arr = arrayTemp;
				
				this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, buffer.W, buffer.H, 0, this.gl.RGBA, this.gl.FLOAT, arr); 
			}
		}
	}
};

/**
* Perform calculation and save the result on a WebCLGLBuffer
* @type Void
* @param {WebCLGLKernel} kernel 
* @param {WebCLGLBuffer} buffer
*/
WebCLGL.prototype.enqueueNDRangeKernel = function(kernel, buffer) {	 
	if(kernel.isReady() == true) {
		this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, buffer.fBuffer); 
		this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, buffer.textureData, 0);
		this.gl.viewport(0, 0, buffer.W, buffer.H);  
		this.gl.useProgram(kernel.kernel);  
		
		for(var n = 0, f = kernel.samplers.length; n < f; n++) {
			eval("this.gl.activeTexture(this.gl.TEXTURE"+n+");")
			this.gl.bindTexture(this.gl.TEXTURE_2D, kernel.samplers[n].value.textureData);
			this.gl.uniform1i(kernel.samplers[n].location, n);
		}
		for(var n = 0, f = kernel.uniformsFloat.length; n < f; n++) {
			this.gl.uniform1f(kernel.uniformsFloat[n].location, kernel.uniformsFloat[n].value);
		}
		
		this.gl.enableVertexAttribArray(kernel.attr_VertexPos);
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer_QUAD);
		this.gl.vertexAttribPointer(kernel.attr_VertexPos, 3, this.gl.FLOAT, false, 0, 0);
		
		this.gl.enableVertexAttribArray(kernel.attr_TextureCoord);
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureBuffer_QUAD);
		this.gl.vertexAttribPointer(kernel.attr_TextureCoord, 3, this.gl.FLOAT, false, 0, 0);
		
		this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer_QUAD);
		this.gl.drawElements(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_SHORT, 0);
	}
};
/**
* Get the internally WebGLTexture (type FLOAT), if the WebGLRenderingContext was given. <br>  
* @returns {WebGLTexture}
*/
WebCLGL.prototype.enqueueReadBuffer_WebGLTexture = function(buffer) {	
	return buffer.textureData;
};
/**
* Compute readpixel
* @private 
*/
WebCLGL.prototype.enqueueReadBuffer = function(buffer) {	
	this.gl.uniform1i(this.u_offset, buffer.offset); 
	
	this.gl.activeTexture(this.gl.TEXTURE0);
	this.gl.bindTexture(this.gl.TEXTURE_2D, buffer.textureData);
	this.gl.uniform1i(this.sampler_buffer, 0);
	
	
	this.gl.enableVertexAttribArray(this.attr_VertexPos);
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer_QUAD);
	this.gl.vertexAttribPointer(this.attr_VertexPos, 3, this.gl.FLOAT, false, 0, 0);
	
	this.gl.enableVertexAttribArray(this.attr_TextureCoord);
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureBuffer_QUAD);
	this.gl.vertexAttribPointer(this.attr_TextureCoord, 3, this.gl.FLOAT, false, 0, 0);
	
	this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer_QUAD);
	this.gl.drawElements(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_SHORT, 0);
	
	
	//console.log(buffer.outArray4Uint8Array); 
	this.gl.readPixels(0, 0, buffer.W, buffer.H, this.gl.RGBA, this.gl.UNSIGNED_BYTE, buffer.outArray4Uint8Array);
	//console.log(buffer.outArray4Uint8Array);  
	return buffer.outArray4Uint8Array;  
	
	//this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
	//this.gl.clear(this.gl.COLOR_BUFFER_BIT);
};
/**
* Get native packet 4Uint8Array from WebCLGLBuffer type FLOAT <br>
* Internally performs one renderToTexture from the computed WebGLTexture storing the result in a "packetUint8Array RGBA" and returns the result through a gl.readPixels().
* @param {WebCLGLBuffer} buffer
* @returns {Uint8Array}
* @example
* // Unpack in your shader to float with:
* float unpack (vec4 4Uint8Array) {
*	const vec4 bitShifts = vec4(1.0,1.0 / 255.0, 1.0 / (255.0 * 255.0), 1.0 / (255.0 * 255.0 * 255.0));
* 	return dot(4Uint8Array, bitShifts);
* }
* float offset = "OFFSET OF BUFFER";
* vec4 4Uint8Array = atributeFloatInPacket4Uint8Array; // IF UNPACK IN VERTEX PROGRAM
* vec4 4Uint8Array = texture2D(samplerFloatInPacket4Uint8Array, vTextureScreenCoord); // IF UNPACK IN FRAGMENT PROGRAM
* float value = (offset > 0.0) ? (unpack(4Uint8Array)*(offset*2.0))-offset : unpack(4Uint8Array);
*
* // JAVASCRIPT IF UNPACK IN VERTEX PROGRAM
* attr_FloatInPacket4Uint8Array = gl.getAttribLocation(shaderProgram, "atributeFloatInPacket4Uint8Array");
* gl.bindBuffer(gl.ARRAY_BUFFER, webGLBufferObject);
* gl.bufferSubData(gl.ARRAY_BUFFER, 0, webCLGL.enqueueReadBuffer_Float_Packet4Uint8Array(buffer_XX));  
* gl.vertexAttribPointer(attr_FloatInPacket4Uint8Array, 4, gl.UNSIGNED_BYTE, true, 0, 0); // true for normalize
*
* // JAVASCRIPT IF UNPACK IN FRAGMENT PROGRAM
* sampler_FloatInPacket4Uint8Array = gl.getUniformLocation(shaderProgram, "samplerFloatInPacket4Uint8Array");
* gl.activeTexture(gl.TEXTURE0);
* gl.bindTexture(gl.TEXTURE_2D, webGLTextureObject);
* gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, viewportWidth,viewportHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, webCLGL.enqueueReadBuffer_Float_Packet4Uint8Array(buffer_XX));
* gl.uniform1i(sampler_FloatInPacket4Uint8Array, 0);


*/
WebCLGL.prototype.enqueueReadBuffer_Float_Packet4Uint8Array = function(buffer) {	 
	this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null); 
	this.gl.viewport(0, 0, buffer.W, buffer.H); 
	if(this.e != undefined) {this.e.width = buffer.W;this.e.height = buffer.H;}
	this.gl.useProgram(this.shader_readpixels);  
	
	this.gl.uniform1i(this.u_vectorValue, 0);
	return this.enqueueReadBuffer(buffer);
};
/**
* Get Float32Array from WebCLGLBuffer type FLOAT <br>
* Internally performs one calls to enqueueReadBuffer_Float_Packet4Uint8Array and makes unpacking
* @param {WebCLGLBuffer} buffer
* @returns {Float32Array}
*/
WebCLGL.prototype.enqueueReadBuffer_Float = function(buffer) {	
	this.outArrayFloat32ArrayX = [];
	this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null); 
	this.gl.viewport(0, 0, buffer.W, buffer.H); 
	if(this.e != undefined) {this.e.width = buffer.W;this.e.height = buffer.H;}
	this.gl.useProgram(this.shader_readpixels);  
	
	this.gl.uniform1i(this.u_vectorValue, 0);
	var packet4Uint8Array = this.enqueueReadBuffer(buffer);
	for(var n = 0, f = packet4Uint8Array.length/4; n < f; n++) {
		var idd = n*4;
		if(buffer.offset>0) buffer.outArrayFloat32ArrayX[n] = (this.utils.unpack([packet4Uint8Array[idd+0]/255,
																					packet4Uint8Array[idd+1]/255,
																					packet4Uint8Array[idd+2]/255,
																					packet4Uint8Array[idd+3]/255])*(buffer.offset*2))-buffer.offset;
		else buffer.outArrayFloat32ArrayX[n] = (this.utils.unpack([	packet4Uint8Array[idd+0]/255,
																	packet4Uint8Array[idd+1]/255,
																	packet4Uint8Array[idd+2]/255,
																	packet4Uint8Array[idd+3]/255]));
	}
	
	return buffer.outArrayFloat32ArrayX;  
};
/**
* Get 4Float32Array from WebCLGLBuffer type FLOAT4 <br>
* Internally performs four calls to enqueueReadBuffer_Float_Packet4Uint8Array and makes unpacking
* @param {WebCLGLBuffer} buffer
* @returns {Float32Array}
*/
WebCLGL.prototype.enqueueReadBuffer_Float4 = function(buffer) {	 
	this.outArrayFloat32ArrayX = [];
	this.outArrayFloat32ArrayY = [];
	this.outArrayFloat32ArrayZ = [];
	this.outArrayFloat32ArrayW = [];
	this.outArray4Float32Array = [];
	this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null); 
	this.gl.viewport(0, 0, buffer.W, buffer.H); 
	if(this.e != undefined) {this.e.width = buffer.W;this.e.height = buffer.H;}
	this.gl.useProgram(this.shader_readpixels);  
	
	this.gl.uniform1i(this.u_vectorValue, 0);
	var packet4Uint8Array = this.enqueueReadBuffer(buffer);
	for(var n = 0, f = packet4Uint8Array.length/4; n < f; n++) {
		var idd = n*4;
		if(buffer.offset>0) buffer.outArrayFloat32ArrayX[n] = (this.utils.unpack([packet4Uint8Array[idd+0]/255,
																					packet4Uint8Array[idd+1]/255,
																					packet4Uint8Array[idd+2]/255,
																					packet4Uint8Array[idd+3]/255])*(buffer.offset*2))-buffer.offset;
		else buffer.outArrayFloat32ArrayX[n] = (this.utils.unpack([	packet4Uint8Array[idd+0]/255,
																	packet4Uint8Array[idd+1]/255,
																	packet4Uint8Array[idd+2]/255,
																	packet4Uint8Array[idd+3]/255]));
	}
	
	this.gl.uniform1i(this.u_vectorValue, 1);
	packet4Uint8Array = this.enqueueReadBuffer(buffer);
	for(var n = 0, f = packet4Uint8Array.length/4; n < f; n++) {
		var idd = n*4;
		if(buffer.offset>0) buffer.outArrayFloat32ArrayY[n] = (this.utils.unpack([packet4Uint8Array[idd+0]/255,
																					packet4Uint8Array[idd+1]/255,
																					packet4Uint8Array[idd+2]/255,
																					packet4Uint8Array[idd+3]/255])*(buffer.offset*2))-buffer.offset;
		else buffer.outArrayFloat32ArrayY[n] = (this.utils.unpack([	packet4Uint8Array[idd+0]/255,
																	packet4Uint8Array[idd+1]/255,
																	packet4Uint8Array[idd+2]/255,
																	packet4Uint8Array[idd+3]/255]));
	}
	
	this.gl.uniform1i(this.u_vectorValue, 2);
	packet4Uint8Array = this.enqueueReadBuffer(buffer);
	for(var n = 0, f = packet4Uint8Array.length/4; n < f; n++) {
		var idd = n*4;
		if(buffer.offset>0) buffer.outArrayFloat32ArrayZ[n] = (this.utils.unpack([packet4Uint8Array[idd+0]/255,
																					packet4Uint8Array[idd+1]/255,
																					packet4Uint8Array[idd+2]/255,
																					packet4Uint8Array[idd+3]/255])*(buffer.offset*2))-buffer.offset;
		else buffer.outArrayFloat32ArrayZ[n] = (this.utils.unpack([	packet4Uint8Array[idd+0]/255,
																	packet4Uint8Array[idd+1]/255,
																	packet4Uint8Array[idd+2]/255,
																	packet4Uint8Array[idd+3]/255]));
	}
	
	this.gl.uniform1i(this.u_vectorValue, 3);
	packet4Uint8Array = this.enqueueReadBuffer(buffer);
	for(var n = 0, f = packet4Uint8Array.length/4; n < f; n++) {
		var idd = n*4; 
		if(buffer.offset>0) buffer.outArrayFloat32ArrayW[n] = (this.utils.unpack([packet4Uint8Array[idd+0]/255,
																					packet4Uint8Array[idd+1]/255,
																					packet4Uint8Array[idd+2]/255,
																					packet4Uint8Array[idd+3]/255])*(buffer.offset*2))-buffer.offset;
		else buffer.outArrayFloat32ArrayW[n] = (this.utils.unpack([	packet4Uint8Array[idd+0]/255,
																	packet4Uint8Array[idd+1]/255,
																	packet4Uint8Array[idd+2]/255,
																	packet4Uint8Array[idd+3]/255]));
	}
	
	for(var n = 0, f = buffer.outArrayFloat32ArrayX.length; n < f; n++) {
		var idd = n*4;
		buffer.outArray4Float32Array[idd] = buffer.outArrayFloat32ArrayX[n];
		buffer.outArray4Float32Array[idd+1] = buffer.outArrayFloat32ArrayY[n];
		buffer.outArray4Float32Array[idd+2] = buffer.outArrayFloat32ArrayZ[n];
		buffer.outArray4Float32Array[idd+3] = buffer.outArrayFloat32ArrayW[n]; 
	}
	
	return buffer.outArray4Float32Array;  
	
};