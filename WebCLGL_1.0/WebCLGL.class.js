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
* Class for parallelization of calculations using the WebGL context similarly to webcl without the need for floating point texture capabilities (OES_texture_float)
* @class
* @constructor
* @param {Int} length
* @param {Bool} unsigned If true the range is from 0.0 to 1.0 with six decimals of presicion. else -1000.0 to 1000.0
*/
WebCLGL = function(length, unsigned) { 
	unsig = (unsigned!=undefined)?unsigned:false;
	this.offset = (unsig==true)?0.0:1000.0; 
	this.W = Math.sqrt(length);
	this.H = this.W;
	
	var e = document.createElement('canvas');
	e.width = this.W;
	e.height = this.H;
	try {
		this.gl = e.getContext("webgl");
	} catch(e) {
		this.gl = undefined;
    }
	if(this.gl == undefined) {
		try {
			this.gl = e.getContext("experimental-webgl");
		} catch(e) {
			this.gl = undefined;
		}
	}
	
	
	var mesh = this.loadQuad(undefined,1.0,1.0);
	this.vertexBuffer_QUAD = this.gl.createBuffer();
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer_QUAD);
	this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(mesh.vertexArray), this.gl.STATIC_DRAW);
	this.textureBuffer_QUAD = this.gl.createBuffer();
	this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.textureBuffer_QUAD);
	this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(mesh.textureArray), this.gl.STATIC_DRAW);
	this.indexBuffer_QUAD = this.gl.createBuffer();
	this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer_QUAD);
	this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indexArray), this.gl.STATIC_DRAW);
	
	this.gl.viewport(0, 0, this.W, this.H);  
	this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
};

/**
* Create a empty WebCLGLBuffer 
* @returns {WebCLGLBuffer} 
*/
WebCLGL.prototype.createBuffer = function() {	
	var webclglBuffer = new WebCLGLBuffer(this.gl, this.W*this.H, this.offset);
	return webclglBuffer;
};

/**
* Create a kernel
* @returns {WebCLGLKernel} 
* @param {String} [source=undefined]
* @param {String} [header=undefined] Additional functions 
*/
WebCLGL.prototype.createKernel = function(source, header) {  
	var webclglKernel = new WebCLGLKernel(this.gl, this.W*this.H, this.offset, source, header);
	return webclglKernel;
};

/**
* Perform calculation and save the result on a WebCLGLBuffer
* @type Void
* @param {WebCLGLKernel} kernel 
* @param {WebCLGLBuffer} buffer
*/
WebCLGL.prototype.enqueueNDRangeKernel = function(kernel, buffer) {	 
	if(kernel.isReady() == true) {
		this.gl.useProgram(kernel.kernel);  
		for(var n = 0, f = kernel.samplers.length; n < f; n++) {
			eval("this.gl.activeTexture(this.gl.TEXTURE"+n+");")
			this.gl.bindTexture(this.gl.TEXTURE_2D, kernel.samplers[n].value.bufferData);
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
		
		
		//console.log(buffer.outArray4Uint8Array); 
		this.gl.readPixels(0, 0, this.W, this.H, this.gl.RGBA, this.gl.UNSIGNED_BYTE, buffer.outArray4Uint8Array);
		//console.log(buffer.outArray4Uint8Array);
		buffer.enqueueWriteBuffer_4Uint8Array(buffer.outArray4Uint8Array); 
		
		//this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
		//this.gl.clear(this.gl.COLOR_BUFFER_BIT);
	} else alert("kernel is not ready");
};







/**
* @private 
*/
WebCLGL.prototype.loadQuad = function(node, length, height) {
	var l=(length==undefined)?0.5:length;
	var h=(height==undefined)?0.5:height;
	this.vertexArray = [-l, -h, 0.0,
	                     l, -h, 0.0,
	                     l,  h, 0.0,
	                    -l,  h, 0.0];
	
	this.textureArray = [0.0, 0.0, 0.0,
	                     1.0, 0.0, 0.0,
	                     1.0, 1.0, 0.0,
	                     0.0, 1.0, 0.0];
	
	this.indexArray = [0, 1, 2,      0, 2, 3];
	
	var meshObject = new Object;
	meshObject.vertexArray = this.vertexArray;
	meshObject.vertexItemSize = this.vertexItemSize;
	meshObject.vertexNumItems = this.vertexNumItems;
	
	meshObject.textureArray = this.textureArray;
	meshObject.textureItemSize = this.textureItemSize;
	meshObject.textureNumItems = this.textureNumItems;
	
	meshObject.indexArray = this.indexArray;
	meshObject.indexItemSize = this.indexItemSize;
	meshObject.indexNumItems = this.indexNumItems;
	
	return meshObject;
};
