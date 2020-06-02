(RaiselyComponents, React) => {
	const { SlimContent } = RaiselyComponents.Loading;
	const { ProfileImage, ProgressBar } = RaiselyComponents.Atoms;
	const { useState, useEffect } = React;
	const { get } = RaiselyComponents.Common;

	const mockCostumes = [
		{ rank: 1, name: 'Apron as a Cape', photoUrl: 'https://raisely-images.imgix.net/chris-birthday-wish/uploads/20200602-002219-jpg-7ffcba.jpg', total: 8 },
		{ rank: 2, name: 'Cardboard Hat', photoUrl: '', total: 4 },
		{ rank: 3, name: 'Black Crew Top', photoUrl: '', total: 2 },
		{ rank: 4, name: 'Germany World Cup Scarf', photoUrl: '', total: 1 },
	];

	const defaultImage = 'https://raisely-images.imgix.net/chris-birthday-wish/uploads/20200602-002219-jpg-7ffcba.jpg';

	function Tile(props) {
		const detail = 'default';
		const { goal, profile } = props;
		const { total } = profile;

		return (
			<React.Fragment>
				{props.header}
				<div className={`profile-tile profile-tile--detail-${detail}`}>
					<ProfileImage
						defaultImage={defaultImage}
						profile={profile}
					/>
					<div className="profile-tile__content">
						{props.showAsLoading && (
							<SlimContent
								longer
								style={{ height: '2.8rem', width: '100%' }}
							/>
						)}
						{!props.showAsLoading && (
							<React.Fragment>
								<p className="profile-tile__name">{profile.name}</p>
								<span className="profile-tile__total">
									{total}
								</span>
								<ProgressBar
									profile={profile}
									displaySource="custom"
									total={total}
									goal={goal}
									showTotal={false}
									showGoal={false}
									size="small"
									style="rounded"
								/>
								<div className="profile-tile__rank">
									{profile.rank}
								</div>
							</React.Fragment>
						)}
					</div>
				</div>
			</React.Fragment>
		);
	}

	const leaderboardClass = (theme) => `profilelist profilelist--${theme}`;

	async function loadCostumes(props) {
		if (get(props, 'global.campaign.mock')) return mockCostumes;
		const url = 'PATH TO CLOUD FUNCTION';
		try {
			const response = await fetch(url);

			if (!response.ok) {
				console.error(await response.text());
				throw new Error('Could not load. Try refreshing the page');
			}
			const body = await response.json();
			return body.data.costumeVotes;
		} catch (error) {
			console.error(error);
			return null;
		}
	}

	return function Leaderboard(props) {
		const profileListTheme = 'default';

		const [costumes, setCostumes] = useState([{}]);
		const [isLoading, setLoading] = useState(true);

		useEffect(() => {
			async function load() {
				const data = await loadCostumes(props);
				if (data) {
					setCostumes(data);
					setLoading(false);
				}
			}
			load();
		}, []);

		// get (optional) props specific to pagination and pass to the helper
		return (
			<div className={leaderboardClass(profileListTheme)}>
				{props.header}
				{costumes.map((costume) => (
					<div
						key={costume ? costume.uuid : undefined}
						className="profilelist__item"
					>
						<Tile
							defaultImage={props.defaultImage || ''}
							theme={profileListTheme}
							profile={costume}
							showAsLoading={isLoading}
							goal={Math.max(...costumes.map(p => p.total))}
						/>
					</div>
				))}
			</div>
		);
	}
}
