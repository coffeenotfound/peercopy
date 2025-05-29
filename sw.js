
// Force immediate sw update
self.addEventListener('install', (event) => {
	self.skipWaiting(); // Activate the new SW immediately
});
self.addEventListener('activate', (event) => {
	event.waitUntil(
		self.clients.claim() // Take control of all clients (tabs)
	);
});

//self.activeDownloadStreamsByFileIdx = {};
self.lastDownloadStream = null

self.addEventListener('message', e => {
	if (e.data.msg === "start-dl") {
		const fileIdx = e.data.fileIdx;
		const fileByteSize = e.data.fileByteSize;
		const encodedFilename = e.data.encodedFilename;
		
		const port = e.ports[0];
		
		const stream = e.data.mainThreadStream;
//		const stream = new ReadableStream({
//			start(controller) {
//				port.onmessage = ({data}) => {
//					// DEBUG:
//					console.log(`SW: got msg: ${JSON.stringify(data)} (${data.chunk.byteLength} bytes)`)
//
//					if (data.error) {
//						controller.error(data.error);
//					} else {
//						const chunk = new Uint8Array(data.chunk);
//						controller.enqueue(chunk);
//
//						if (data.done) {
//							console.log("DL DONE, calling ReadableStream.close()")
//							controller.close();
//						}
//					}
//				};
//			},
//			cancel(reason) {
//				// DEBUG:
//				console.log(`ReadableStream got canceled: ${reason}`)
//
//				// Call back to main context to
//				// notify about canceled download
//				// so we can notify to sender to
//				// stop sending bytes
//				port.postMessage({
//					"canceled": true,
//				})
//			},
//		});
		
		const headers = {
			'Content-Type': 'application/octet-stream',
			'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
			'Content-Length': String(fileByteSize),
		}
		const response = new Response(stream, {
			status: 200,
			statusText: "OK",
			headers
		});
		
		// DEBUG:
		console.log("SW: response headers:", headers)
		
		// Add to dir of active downloads
//		self.activeDownloadStreamsByFileIdx[fileIdx] = response;
		self.lastDownloadStream = response;
		
		port.postMessage({ "isReady": true })
	}
});

const regex = /\/dl\/(\d+)$/;

self.addEventListener('fetch', e => {
	// DEBUG:
	console.log('SW intercept:', e.request.url);
	
	const match = e.request.url.match(regex)
	if (match) {
		// DEBUG:
		console.log("intercepted dl request: ", match[1])
		
//		const fileIdx = Number(match[1]);
//		const stream = self.activeDownloadStreamsByFileIdx[fileIdx]
		const stream = self.lastDownloadStream
		e.respondWith(stream);
		self.lastDownloadStream = null;
		//e.respondWith(new Response('', { status: 200 }));
	}
});
