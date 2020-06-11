(RaiselyComponents, React) => {
	const { Button, ProgressBar } = RaiselyComponents.Atoms;
	const { DonationForm } = RaiselyComponents.Molecules;
	const { api } = RaiselyComponents;
	const { getData } = api;
	const { get } = RaiselyComponents.Common;

	return class DonationProfile extends React.Component {
		// Until we've loaded, show the campaign profile
		state = {
			profile: get(this.props, "global.campaign.profile"),
			profilePath: get(this.props, "global.campaign.profile.path"),
			distributedGeneral: 0,
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
				const profiles = await getData(api.profiles.getAll());
				const profile = profiles.find(
					profile =>
						profile.path === profilePath ||
						profile.uuid === profilePath
				);
				const totalSpecific = profiles.reduce(
					(total, profile) => total + profile.total,
					0
				);
				const totalGeneral =
					get(this.props, "global.campaign.total", 0) - totalSpecific;
				const distributedGeneral = totalGeneral / profiles.length;

				console.log(
					`Calculating distributed total (${totalGeneral} - ${totalSpecific}) / ${profiles.length}`
				);
				this.setState({ profile, distributedGeneral, distributedBonus });
			} catch (e) {
				console.error(e);
			}
		};

		donate = () => this.setState({ showDonate: true });

		render() {
			const { props } = this;
			const { profile, showDonate, distributedGeneral } = this.state;

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
							<h4>What they do</h4>
							<p dangerouslySetInnerHTML={{ __html: _.get(profile, 'public.aboutOrg', '') }} />
							<h4>Why I chose this charity</h4>
							<p dangerouslySetInnerHTML={{ __html: _.get(profile, 'description', '') }}></p>
						</div>
						<ProgressBar
							profile={profile}
							displaySource="custom"
							statPosition="middle"
							total={Math.round(
								(profile.total + distributedGeneral) / 100
							)}
							goal={Math.round(profile.goal / 100)}
							showTotal={true}
							showGoal={false}
							style="rounded"
							unit="raised"
						/>
						<div className="donation-profile__button-wrapper">
							<Button onClick={this.donate} theme="secondary">Donate</Button>
						</div>
					</div>
				</div>
			);
		}
	};
};
