(RaiselyComponents, React) => {
	const { Button } = RaiselyComponents.Atoms;
	const { DonationForm, RaiselyShare } = RaiselyComponents.Molecules;
	const { api } = RaiselyComponents;
	const { getData } = api;
	const { get } = RaiselyComponents.Common;

	// Custom Donation Form that shows a prompt to ask for push permission
	// after they subscribe

	const isNotifySupported = () => "serviceWorker" in navigator && "PushManager" in window;

	function CustomDonationThankyou(props) {
		const [loading, setLoading] = useState(false);
		const [grant, setGrant] = useState(null);
		const [error, setError] = useState(null);
		const [isSubscribing, setSubscribing] = useState();
		const [isSubscribed, setSubscribed] = useState(null);

		useEffect(() => {
			if (isNotifySupported()) {
				setLoading(true);
				setError(false);
				navigator.serviceWorker.register("/sw.js")
					.then(() => {
					})
					.catch(e => {
						setError(e);
						console.error(e);
						setLoading(false);
					});
			}
		}, []);

		useEffect(() => {
			const getExixtingSubscription = async () => {
				try {
					const serviceWorker = await navigator.serviceWorker.ready;
					const existingSubscription = await serviceWorker.pushManager.getSubscription();
					setLoading(false);
					setSubscribed(!!existingSubscription);
				} catch (e) {
					setError(e);
					console.error(e);
					setLoading(false)
				}
			};
			getExixtingSubscription();
		}, []);

		async function doSubscribe() {
			const consent = await Notification.requestPermission();
			if (consent !== 'granted') {
				setGrant('denied');
				return;
			}
			const serviceWorker = await navigator.serviceWorker.ready;
			// subscribe and return the subscription
			try {
				const subscription = await serviceWorker.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: pushServerPublicKey,
				});
				setSubscribing(true);
				// Get the id of the user from the donation
				const userUuid = get(this.props, 'lastResult.userUuid');
				await fetch(subscribeUrl, {
					method: 'PUT',
					body: JSON.stringify({
						data: { userUuid, subscription }
					})
				})
				setSubscribed(true);
				// Notify calling component that subscription is complete
				if (onSubscribe) onSubscribe();
			} catch (err) {
				setSubscribing(false);
				console.error(err);
				setError(err);
			} finally {
				setSubscribing(false);
			}
		}

		if (loading) {
			return <Spinner />;
		}

		if (isSubscribed) {
			return (
				<div className="subscribe">
					<p>{`You're`} subscribed to updates!</p>
					<br />
					<p className="donation-form__social-copy">
						Now let&#39;s get the word out there:
					</p>
					<RaiselyShare
						networks="campaign"
						theme="filled"
						size="medium"
						url={props.formProps.customShareUrl || 'current'}
						global={props.global}
					/>
				</div>
			)
		}

		if (error) {
			return (
				<div className="subscribe">
					<p className="error">Error subscribing</p>
				</div>
			)
		}

		return (
			<div className="subscribe">
				<p>{`Don't`} miss out! Get notified when {`there's`} more actions to take</p>
				{grant === 'denied' && (
					<p>You need to grant permission for us to send you notifications</p>
				)}
				<Button onClick={doSubscribe} disabled={isSubscribing}>
					{isSubscribing && <Spinner />} Notify Me
				</Button>
			</div>
		);
	}

	return class DonationPushPrompt extends React.Component {
		render() {
			const { props } = this;

			return (
				<div className="donation-profile__wrapper">
					<DonationForm
						thankYou={CustomDonationThankyou}
						{...props}
					/>
				</div>
			);
		}
	};
};
