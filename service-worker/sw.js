function receivePushNotification(event) {
	console.log("[Service Worker] Push Received.");

	const { actionCount, url, tag, title } = event.data.json();

	const image = 'https://raisely-images.imgix.net/cause-for-hope/uploads/yoann-boyer-i-14-h-2-xy-pr-18-unsplash-jpg-bca474.jpg';

	const body = title || `${actionCount} new actions are ready on Cause for Hope`;

	const options = {
		body,
		image,
		tag,
		// The url to open on click
		data: url,
		icon: image,
		vibrate: [100, 200, 100, 200, 100],
		badge: image,
		actions: [{ action: "Detail", title: "Take Action" }]
	};
	event.waitUntil(self.registration.showNotification(title, options));
}

function openPushNotification(event) {
	console.log("[Service Worker] Notification click Received.", event.notification.data);

	event.notification.close();
	event.waitUntil(clients.openWindow(event.notification.data));
}

self.addEventListener("push", receivePushNotification);
self.addEventListener("notificationclick", openPushNotification);
