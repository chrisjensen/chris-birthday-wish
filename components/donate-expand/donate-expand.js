(RaiselyComponents, React) => {
	const { Button, ProgressBar } = RaiselyComponents.Atoms;
	const { DonationForm } = RaiselyComponents.Molecules;
	const { api } = RaiselyComponents;
	const { getData } = api;
	const { get } = RaiselyComponents.Common;

	return function DonationProfile(props) {
		// Until we've loaded, show the campaign profile
		const [profile, setProfile] = useState(get(props, 'global.campaign.profile'));
		const [profilePath, setProfilePath] = useState(get(props, 'global.campaign.profile.path'));
		const [showDonate, setShowDonate] = useState(false);

		useEffect(() => {
			const load = async () => {
				const { profilePath: newProfilePath } = props.getValues();
				// Nothing to do
				if (newProfilePath === profilePath) return;
				setProfilePath(profilePath);

				try {
					const newProfile = await getData(api.profiles.get({ id: newProfilePath }));
					setProfile(newProfile)
				} catch (e) {
					console.error(e);
				}
			}
			load();
		});

		return (
			<div className="donation-profile__wrapper spotlight-donate">
				{showDonate ? (
					<DonationForm
						profileUuid={profile.uuid}
						title={`Donate to ${profile.name}`}
						integrations={props.integrations}
						global={props.global}
					/>
				) : (
						<div className="donation-profile__button-wrapper">
							<Button onClick={() => setShowDonate(true)} theme="secondary">Donate</Button>
						</div>
					)}
			</div>
		);
	}
}
