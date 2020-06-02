(RaiselyComponents, React) => {
	const { Button, ProgressBar } = RaiselyComponents.Atoms;
	const { DonationForm } = RaiselyComponents.Molecules;
	const { api } = RaiselyComponents;
	const { getData } = api;
	const { get } = RaiselyComponents.Common;

	return class DonationProfile extends React.Component {
		// Until we've loaded, show the campaign profile
		state = {
			profile: get(this.props, 'global.campaign.profile'),
			profilePath: get(this.props, 'global.campaign.profile.path')
		};

		componentDidMount() {
			this.load();
		}
		componentDidUpdate() {
			this.load();
		}

		load = async () => {
			const { profilePath } = this.props.getValues();
			// Nothing to do
			if (profilePath === this.state.profilePath) return;
			this.setState({ profilePath });

			try {
				const profile = await getData(api.profiles.get({ id: profilePath }));
				this.setState({ profile });
			} catch (e) {
				console.error(e);
			}
		}

		donate = () => this.setState({ showDonate: true });

		render() {
			const { props } = this;
			const { profile, showDonate } = this.state;

			if (showDonate) {
				return (
					<div className="donation-profile__wrapper">
						<DonationForm
							profileUuid={profile.uuid}
							title={`Donate to ${profile.name}`}
							integrations={props.integrations}
							global={props.global}
						/>
					</div>
				);
			}
			return (
				<div className="donation-profile__wrapper spotlight-donate">
					<div className="donation-profile__item">
						<div className="donation-profile__body">
							<h3>{profile.name}</h3>
							<p>{profile.description}</p>
						</div>
						<div className="donation-profile__button-wrapper">
							<Button onClick={this.donate} theme="secondary">Donate</Button>
						</div>
					</div>
					<ProgressBar
						profile={profile}
						statPosition="middle"
						showTotal={false}
						showGoal={false}
						style="rounded"
					/>
				</div>
			);
		}
	}
}
