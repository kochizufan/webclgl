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
WebCLGLBuffer = function(gl, length, offset) { 
	this.gl = gl;
	this.W = Math.sqrt(length);
	this.H = this.W;
	this.offset = offset; 
	
	// PACK 1FLOAT (0.0-1.0) TO 4FLOAT RGBA (0.0-1.0, 0.0-1.0, 0.0-1.0, 0.0-1.0)
	var arrayX = []; 
	for(var n = 0, f = length; n < f; n++) {
		var idd = n*4;
		arrayX[idd+0] = 0;
		arrayX[idd+1] = 0;
		arrayX[idd+2] = 0;
		arrayX[idd+3] = 0;
	}
	 
	this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);
	this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
	
	this.bufferData = this.gl.createTexture();
	this.gl.bindTexture(this.gl.TEXTURE_2D, this.bufferData);
	this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.W,this.H, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array(arrayX));
	this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE); 
	
	
	this.outArray4Uint8Array = new Uint8Array((this.W*this.H)*4);
	this.outArrayFloat32Array = [];

};

/**
* Write on this WebCLGLBuffer with a 4Uint8Array 
* @type Void
* @param {TypedArray} 4Uint8Array 
*/
WebCLGLBuffer.prototype.enqueueWriteBuffer_4Uint8Array = function(arr) {	 
	this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);
	this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
	
	this.gl.bindTexture(this.gl.TEXTURE_2D, this.bufferData);
	this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.W, this.H, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, arr);
};

/**
* Write on this WebCLGLBuffer with a Float32Array (This require a internal conversion from Float32 to 4Uint8)
* @type Void
* @param {Array TypedArray} Float32Array 
*/
WebCLGLBuffer.prototype.enqueueWriteBuffer_Float32Array = function(arr) {
	// PACK 1FLOAT (0.0-1.0) TO 4FLOAT RGBA (0.0-1.0, 0.0-1.0, 0.0-1.0, 0.0-1.0)
	var arrayX = []; 
	for(var n = 0, f = arr.length; n < f; n++) {
		var idd = n*4;
		var arrPack;
		if(this.offset>0.0) arrPack = this.pack((arr[n]+this.offset)/(this.offset*2));
		else arrPack = this.pack(arr[n]);
		arrayX[idd+0] = arrPack[0]*256;
		arrayX[idd+1] = arrPack[1]*256;
		arrayX[idd+2] = arrPack[2]*256;
		arrayX[idd+3] = arrPack[3]*256; 
	}
	//console.log(arr[0]);
	//console.log(arrayX[0]/256.0+' '+arrayX[1]/256.0+' '+arrayX[2]/256.0+' '+arrayX[3]/256.0); 
	
	this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);
	this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
	
	this.gl.bindTexture(this.gl.TEXTURE_2D, this.bufferData);
	this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.W, this.H, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, new Uint8Array(arrayX));
};

/**
* Get 4Uint8Array from this WebCLGLBuffer
* @returns {4Uint8Array}
*/
WebCLGLBuffer.prototype.enqueueReadBuffer_4Uint8Array = function() {
	return this.outArray4Uint8Array;  
};

/**
* Get Float32Array from this WebCLGLBuffer (This require a internal conversion from 4Uint8 to Float32)
* @returns {Float32Array}
*/
WebCLGLBuffer.prototype.enqueueReadBuffer_Float32Array = function() {
	for(var n = 0, f = this.outArray4Uint8Array.length/4; n < f; n++) {
		var idd = n*4;
		if(this.offset>0.0) this.outArrayFloat32Array[n] = (this.unpack([this.outArray4Uint8Array[idd+0]/255,
																	this.outArray4Uint8Array[idd+1]/255,
																	this.outArray4Uint8Array[idd+2]/255,
																	this.outArray4Uint8Array[idd+3]/255])*(this.offset*2))-this.offset;
		else this.outArrayFloat32Array[n] = parseFloat(this.unpack([this.outArray4Uint8Array[idd+0]/255,
														this.outArray4Uint8Array[idd+1]/255,
														this.outArray4Uint8Array[idd+2]/255,
														this.outArray4Uint8Array[idd+3]/255]).toFixed(6));
	}
	//console.log(this.outArray4Uint8Array[0]/255.0+' '+this.outArray4Uint8Array[1]/255.0+' '+this.outArray4Uint8Array[2]/255.0+' '+this.outArray4Uint8Array[3]/255.0); 
	//console.log(this.outArrayFloat32Array[0]);
	return this.outArrayFloat32Array; 
};
 










/**
* Dot product vector4float
* @private 
*/
WebCLGLBuffer.prototype.dot4 = function(vector4A,vector4B) {
	return vector4A[0]*vector4B[0] + vector4A[1]*vector4B[1] + vector4A[2]*vector4B[2] + vector4A[3]*vector4B[3];
};
/**
* Compute the fractional part of the argument. fract(pi)=0.14159265...
* @private 
*/
WebCLGLBuffer.prototype.fract = function(number) {
	return number - Math.floor(number);
};
/**
* Pack 1float (0.0-1.0) to 4float rgba (0.0-1.0, 0.0-1.0, 0.0-1.0, 0.0-1.0)
* @private 
*/
WebCLGLBuffer.prototype.pack = function(v) {
	var bias = [1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0];

	var r = v;
	var g = this.fract(r * 255.0);
	var b = this.fract(g * 255.0);
	var a = this.fract(b * 255.0);
	var colour = [r, g, b, a];
	
	var dd = [colour[1]*bias[0],colour[2]*bias[1],colour[3]*bias[2],colour[3]*bias[3]];
	
	return [colour[0]-dd[0],colour[1]-dd[1],colour[2]-dd[2],colour[3]-dd[3] ];
};
/**
* Unpack 4float rgba (0.0-1.0, 0.0-1.0, 0.0-1.0, 0.0-1.0) to 1float (0.0-1.0)
* @private 
*/
WebCLGLBuffer.prototype.unpack = function(colour) {
	var bitShifts = [1.0, 1.0/255.0, 1.0/(255.0*255.0), 1.0/(255.0*255.0*255.0)];
	return this.dot4(colour, bitShifts);
};