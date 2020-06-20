(RaiselyComponents, React) => {
	const { Button, ProgressBar } = RaiselyComponents.Atoms;
	const { DonationForm } = RaiselyComponents.Molecules;
	const { api } = RaiselyComponents;
	const { getData } = api;
	const { get } = RaiselyComponents.Common;

	// Because a 4th charity was added on 11th June
	// splitting the fundraising total becomes more complicated
	// Donations prior to then were to 3 charities, donations after were to 4 charities
	// so need to be divided accordingly
	// This is the amount that was raised for the original 3 charities
	const originalGeneralTotal = 58107;

	// I'll refer to the first 3 charities as "original"
	// and the newest charity as "bonus"

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
					get(this.props, "global.campaign.total", 0) - totalSpecific - originalGeneralTotal;

				let distributedGeneral = totalGeneral / profiles.length;
				// If this isn't the newly added profile, add the distributed portion of the original total
				if (get(this.props, 'global.campaign.path') === 'chris-birthday-wish') {
					if (profile.path !== 'effective-altruism') distributedGeneral += originalGeneralTotal / 3;
				} else {
					distributedGeneral += originalGeneralTotal / profiles.length;
				}

				console.log(
					`Calculating distributed total (${totalGeneral} - ${totalSpecific}) / ${profiles.length}`
				);
				this.setState({ profile, distributedGeneral });
			} catch (e) {
				console.error(e);
			}
		};

		donate = () => this.setState({ showDonate: true });

		renderSection = (profile, heading, key) => {
			const value = _.get(profile, key);
			if (!value) return null;

			return (
				<React.Fragment>
					<h4>{heading}</h4>
					<p
						dangerouslySetInnerHTML={{
							__html: value
						}}
					></p>
				</React.Fragment>
			);
		}

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
							{profile.path === "effective-altruism" ? (
								<React.Fragment>
									{this.renderSection(profile, 'Why I chose this charity', 'description')}
									{this.renderSection(profile, 'What they do', 'public.aboutOrg')}
								</React.Fragment>
							) : (
									<React.Fragment>
										{this.renderSection(profile, 'What they do', 'public.aboutOrg')}
										{this.renderSection(profile, 'Why I chose this charity', 'description')}
									</React.Fragment>
								)}
						</div>
						<ProgressBar
							profile={profile}
							displaySource="custom"
							statPosition="middle"
							total={Math.trunc(
								(profile.total + distributedGeneral) / 100
							)}
							goal={Math.trunc(profile.goal / 100)}
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
