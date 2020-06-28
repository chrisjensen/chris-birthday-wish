function receivePushNotification(event) {
	console.log("[Service Worker] Push Received.");

	const { title, code } = event.data.json();

	const image = 'https://raisely-images.imgix.net/chris-birthday-wish/uploads/mamun-srizon-7-b-mj-9-rycb-i-unsplash-jpg-3c513f.jpg?fit=max&w=800&auto=format&q=62';

	const body = title || `${donor.preferredName} you've lost the lead on Chris's birthday fundraiser`;

	const options = {
		body,
		image,
		tag: code,
		// The url to open on click
		data: '/',
		icon: image,
		vibrate: [100, 200, 100, 200, 100],
		badge: image,
		actions: [{ action: "Donate", title: "Donate" }]
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
