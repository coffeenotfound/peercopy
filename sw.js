
self.addEventListener('fetch', event => {
	if (new URL(event.request.url).pathname === '/dl') {
		event.respondWith(new Response('', { status: 200 }));
	}
});

self.activeDownloadStreamsByFileIdx = {};

self.addEventListener('message', e => {
	if (e.data.msg === "start-dl") {
		const fileIdx = e.data.fileIdx;
		const fileByteSize = e.data.fileByteSize;
		
		const port = e.ports[0];
		
		const stream = new ReadableStream({
			start(controller) {
				port.onmessage = ({data}) => {
					let removeFromDir = false;
					if (data.error) {
						controller.error(data.error);
						removeFromDir = true;
					} else if (data.done) {
						controller.close();
						removeFromDir = true
					} else {
						controller.enqueue(new TextEncoder().encode(data.chunk));
					}
					
					if (removeFromDir) {
						delete self.activeDownloadStreamsByFileIdx[fileIdx];
					}
				};
			},
			cancel(reason) {
				// DEBUG:
				console.log(`canceled stream: ${reason}`)
				
				// Call back to main context to
				// notify about canceled download
				// so we can notify to sender to
				// stop sending bytes
				port.postMessage({
					msg: "dl-canceled",
					fileIdx: fileIdx
				})
			},
		});
		
		const response = new Response(stream, {
			headers: {
				'Content-Type': 'text/plain',
				'Content-Disposition': 'attachment',
				'Content-Length': String(fileByteSize),
			}
		});
		
		// Add to dir of active downloads
		self.activeDownloadStreamsByFileIdx[fileIdx] = response;
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
		
		const fileIdx = Number(match[1]);
		e.respondWith(self.activeDownloadStreamsByFileIdx[fileIdx]);
		//e.respondWith(new Response('', { status: 200 }));
	}
});
