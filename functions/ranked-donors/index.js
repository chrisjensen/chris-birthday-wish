const _ = require('lodash');
const axios = require('axios');
const cache = require('nano-cache');

const RAISELY_API = 'https://api.raisely.com/v3'
const CAMPAIGN_PATH = 'chris-birthday-wish';
const RAISELY_TOKEN = process.env.RAISELY_TOKEN;

let getDonorsPromise;

module.exports = async function (context, req) {
	// Make it easy to clear the cache by passing ?clearCache=1
	if (req.query.clearCache) {
		cache.clear();
	}

	try {
		const donors = await getCachedDonors();
		context.res = {
			status: 200,
			body: {
				data: donors,
			},
		}
	} catch (error) {
		context.res = {
			status: 500,
			body: {
				error: { message: error.message }
			},
		}
	}
};

async function getCachedDonors() {
	// Cache for 30 minutes
	// (new donations will trigger a webhook that clears the the cache)
	const ttl = 30 * 60 * 1000;
	let results = cache.get('donors');

	if (!donors) {
		// Save the promise so if others come looking for
		// the donors we don't send multiple requests
		if (!getDonorsPromise) getDonorsPromise = getRankedDonors();
		try {
			results = await getDonorsPromise;
			// Check if another thread hasn't already returned and updated the cache
			if (!cache.get('donors')) {
				cache.set('donors', results, { ttl });
			}
		} finally {
			// Always clear the promise at the
			// end so we re-fetch when the cache
			// expires or the request fails
			getDonorsPromise = null;
		}
	}

	return results;
}

async function getRankedDonors() {
	const [donations, costumeField] = await Promise.all([
		fetchDonations(),
		fetchCostumeField(),
	]);
	const donors = compileDonors(donations);
	const costumeVotes = compileCostumeVotes(donations, costumeField);
	const rankedDonors = donors.sort((a, b) => a.total - b.total);
	return { donors: rankedDonors, costumeVotes };
}

async function fetchDonations() {
	// Load the details of this user to check if they are an admin
	const url = `${RAISELY_API}/campaigns/${CAMPAIGN_PATH}/donations?limit=150`;

	const { data: donations } = await axios.get(url);

	return donations;
}

async function fetchCostumeField() {
	// Load the details of this user to check if they are an admin
	const url = `${RAISELY_API}/campaigns/${CAMPAIGN_PATH}/fields?private=1`;

	const { data: fields } = await axios.get(url, {
		headers: { authorization: `bearer ${RAISELY_TOKEN}` }
	});

	const costumeField = fields.find(f => f.name === 'costumeVote');

	return costumeField;
}

function compileDonors(donations) {
	// Donors tallied by donor.user.uuid
	const donors = {};

	donations.forEach(donation => {
		const { uuid } = donation.user;
		if (!donors[uuid]) {
			donors[uuid] = {
				preferredName: donation.preferredName,
				total: 0,
				count: 0,
				uuid: uuid,
			}
		}

		donors[uuid].count += 1;

		// To be 100% accurate we should use campaignAmount which would mean we're comparing
		// same currency
		// however, in practice donations will likely be split between Singaporean and Australian donors
		// and comparing the absolute value would give Singaporean donors a slight advantage
		// as people will mostly use the provided dollar handles.
		// At current exchange rates, two people choosing the $30 handle would donate
		// 30 AUD and 30 SGD (~ 31.69 AUD), so Singaporeans would always
		// beat Australian's by default, so I'll use local currency so as to stimulate
		// more friendly competition
		//
		// (But yes, this means someone could game the system by donating in Indonesian Rupees)
		donors[uuid].total += donation.amount;
	});

	return Object.values(donors);
}

function addVote(costumes, { name, id, photoUrl }) {
	if (!id) id = _.camelCase(name);
	if (!name) name = _.startCase(id);
	if (!costumes[id]) {
		costumes[id] = {
			id,
			name,
			photoUrl,
			total: 0,
		}
	}
	costumes[id].total += 1;
}

function compileCostumeVotes(donations, costumeField) {
	const costumes = {};
	costumeField.options.forEach(costume => costumes[costume.value] = {
		id: costume.value, name: costume.label, photoUrl: costume.photoUrl, total: 0
	});

	donations.forEach(donation => {
		const id = _.get(donation, 'public.costumeVote');
		if (id) addVote(costumes, { id });

		// If they created a new item, give it their vote
		const name = _.get(donation, 'public.clothing');
		if (name) {
			addVote(costumes, { name, photoUrl: _.get(donation, 'public.pictureOfCostumeItem') });
		}
	});

	const costumeVotes = Object.values(costumes)
		.sort((a, b) => a.total - b.total);

	// Assign a rank to each
	let rank = 0;
	let lastTotal = -1;
	costumeVotes.forEach(costume => {
		if (lastTotal !== costume.total) rank += 1;
		costume.rank = rank;
	});

	return costumeVotes;
}
