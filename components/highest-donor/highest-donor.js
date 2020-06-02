(RaiselyComponents, React) => {
	const { useEffect, useState } = React;
	const { get } = RaiselyComponents.Common;

	return function HighestDonor() {
		const [leadDonor, setLeadDonor] = useState('________');
		const [leadGap, setLeadGap] = useState(5);

		useEffect(() => {
			async function fetchData() {
				const response = await fetch(url);

				if (!response.ok) {
					console.error(await response.text());
					throw new Error('Could not load. Try refreshing the page');
				}
				const body = await response.json();
				const [topDonor, secondDonor] = body.data.donors;
				if (topDonor) {
					setLeadDonor(topDonor.preferredName);
					setLeadGap(topDonor.total - getComputedStyle(secondDonor, 'total', 0));
				}
			}
			fetchData()
				.catch(e => console.error(e));
		}, []);

		return (
			<div className="highest-donor__wrapper">
				<p className="highest-donor__body">Chris will dance to a song chosen by {leadDonor}</p>
				<p className="highest-donor__gap">(or you if you donate ${leadGap})</p>
			</div>
		);
	}
}
