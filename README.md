webclgl
=======
<h2>Javascript Library for general purpose computing on GPU, aka GPGPU.</h2>
WebCLGL use a code style like WebCL for handle the operations (more understandable that WebGL if not is for graphics end) and which then translates to WebGL code.<br />
Not 100% the same as the future <a href="https://en.wikipedia.org/wiki/WebCL">WebCL specification</a> nor has all its advantages. Some limitations are:<br />
- Writing over multiple buffers in a single kernel.<br />
- Read and write a buffer at same time. (In this case you must create a temporary buffer for the writing and later fix the changes with the webCLGL.copy function.)<br />

<h3>Examples</h3>
- <a href="http://stormcolour.appspot.com/?sec=livecode&secb=WebCLGL"> Basic example A+B</a><br />
- <a href="http://stormcolour.appspot.com/?sec=livecode&secb=WebCLGL-Benchmarks"> Benchmarks</a><br />
- <a href="http://stormcolour.appspot.com/?sec=livecode&secb=Using%20webclgl%20vector"> Using vectors</a><br />
- <a href="http://stormcolour.appspot.com/?sec=livecode&secb=Vector%20output"> Using vectors as output</a><br />
- <a href="http://stormcolour.appspot.com/?sec=livecode&secb=WebCLGL%20-%20compare%20values%20%E2%80%8B%E2%80%8Bwith%20other%20ids"> Compare values ??with other ids</a><br />


<h3><a href="http://stormcolour.appspot.com/CONTENT/WebCLGL-2.0-API-Doc/WebCLGL.html">API Doc WebCLGL 2.0</a></h3>
<h3><a href="http://www.khronos.org/files/webgl/webgl-reference-card-1_0.pdf">OpenGL ES Shading Language 1.0 Reference Card (Pag 3-4)</a></h3>
<br />
<br />
<h3>Last changes</h3>
<div style="font-size:9px">

*WebCLGL 2.0 BETA4* Dec 4, 2013<br />
Offset parameter at now must be indicated in createBuffer function.<br />
Added function enqueueReadBuffer_WebGLTexture().<br />
Added function copy(bufferToRead, bufferToWrite).<br />
<br />
*WebCLGL 2.0 BETA4* Nov 23, 2013<br />
enqueueWriteBuffer function allows use a WebGLTexture object and HTMLImageElement.<br />
Added optional argument "flip" in enqueueWriteBuffer function.<br />
<br />
*WebCLGL 2.0 BETA3* Nov 03, 2013<br />
Fixed bug that prevented write to a buffer with a different length than indicated in "new WebCLGL(length, offset, webglcontext)".<br />
Removed length argument in "new WebCLGL(length, offset, webglcontext)".<br />
<br />
*WebCLGL 2.0 BETA2* Nov 03, 2013<br />
Now you can provide a specific context WebGL and save directly at your floating point texture using enqueueNDRangeKernel, in the case that you are using WebGL in your application and you want an improvement in performance.<br />
<br />
*WebCLGL 2.0 BETA1* Oct 28, 2013<br />
Now uses floating point texture capabilities (OES_texture_float), float and vector (in/out) and others improvements.<br />
<br />