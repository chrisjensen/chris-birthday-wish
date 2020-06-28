const _ = require('lodash');
const axios = require('axios');
const cache = require('nano-cache');

const RAISELY_API = 'https://api.raisely.com/v3'
const CAMPAIGN_PATH = 'chris-birthday-wish';
const RAISELY_TOKEN = process.env.RAISELY_TOKEN;

let getDonorsPromise;

/**
 * Cloud function that compiles and caches
 * * Donor rankings by total donated
 * * Votes for clothing items
 * @param {*} context
 * @param {*} req
 */
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

/**
 * Calls the function to calculate and looks up it's result
 * Ensures that concurrent requests simply pull from the cache
 * or wait on a promise that is already in progress
 * @returns {object} The value for the function to return
 */
async function getCachedDonors() {
	// Cache for 120 minutes
	// (new donations will trigger a webhook that clears the the cache)
	const ttl = 120 * 60 * 1000;
	let results = cache.get('donors');

	if (!results) {
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

/**
 * Load donors ranked by total donations and also calculate costume votes
 * @returns {object} { donors, costumeVotes }
 */
async function getRankedDonors() {
	const [donations, costumeField] = await Promise.all([
		fetchDonations(),
		fetchCostumeField(),
	]);
	const donors = compileDonors(donations);
	const costumeVotes = compileCostumeVotes(donations, costumeField);
	const rankedDonors = donors.sort((a, b) => b.total - a.total);
	return { donors: rankedDonors, costumeVotes };
}

/**
 * Load all donations from Raisely
 * @returns {object[]} Donations
 */
async function fetchDonations() {
	// Load the details of this user to check if they are an admin
	const url = `${RAISELY_API}/campaigns/${CAMPAIGN_PATH}/donations?limit=150`;

	const response = await axios.get(url);
	const { data: donations } = response.data;

	return donations;
}

/**
 * Load the costume field from raisely
 * @returns {object} Costume field
 */
async function fetchCostumeField() {
	// Load the details of this user to check if they are an admin
	const url = `${RAISELY_API}/campaigns/${CAMPAIGN_PATH}/fields?private=1`;

	const response = await axios.get(url, {
		headers: { authorization: `bearer ${RAISELY_TOKEN}` }
	});

	const { data: fields } = response.data;

	const costumeField = fields.find(f => f.name === 'costumeVote');

	return costumeField;
}

/**
 * Takes the donations loaded from Raisely and compiles the
 * amount given by each donor in the case of multiple donations
 * @param {*} donations
 * @returns {object[]} An array of donors { preferredName, total, count, uuid }
 */
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

const pathify = (unsanitized) =>
	_.trim(unsanitized, '-')
		.replace(/\s+/g, '-')
		// remove non compatible characters
		.replace(/[^a-zA-Z0-9-]+/g, '')
		// remove consecutive slashes (prevents too many permutations)
		.replace(/[-]{2,}/g, '-')
		// then cast to lowercase
		.toLowerCase();

/**
 * Add a vote for a costume item. If it's the first, the costume item will
 * be added to the map
 * @param {object} costumes Maps from costume item id to an object containing votes and details
 * @param {object} opts
 * @param {string} opts.name
 * @param {string} opts.id
 * @param {string} opts.photoUrl
 */
function addVote(costumes, { name, id, photoUrl }) {
	if (!id) id = pathify(name);
	if (!name) name = _.startCase(id);
	if (!costumes[id]) {
		costumes[id] = {
			id,
			name,
			total: 0,
		}
		if (photoUrl) costumes[id].photoUrl = photoUrl;
	}
	costumes[id].total += 1;
}

/**
 * Compile the votes for costumes
 * @param {object[]} donations All the donations to the campaign
 * @param {object} costumeField Used to initialise the votes list
 * @returns {object[]} Array of costumes with total field for the tallied votes
 */
function compileCostumeVotes(donations, costumeField) {
	const costumes = {};
	// Initialise the costumes map from the values in the costume select field
	costumeField.options.forEach(costume => {
		const { value: id, label: name, photoUrl } = costume;
		costumes[id] = {
			id, name, total: 0
		};
		if (photoUrl) costumes[id].photoUrl = photoUrl;
	});

	// Compile votes from each donation (either what they chose, or what they added)
	donations.forEach(donation => {
		const id = _.get(donation, 'public.costumeVote');
		if (id) addVote(costumes, { id });

		// If they created a new item, give it their vote
		const name = _.get(donation, 'public.clothing');
		if (name) {
			addVote(costumes, { name, photoUrl: _.get(donation, 'public.pictureOfCostumeItem') });
		}
	});

	// Sort the costumes according to highest vote
	const costumeVotes = Object.values(costumes)
		.sort((a, b) => b.total - a.total);

	// Assign a rank to each
	// Does a dense ranking (eg tied second means 1, 2, 2, 3)
	let rank = 0;
	let lastTotal = -1;
	costumeVotes.forEach(costume => {
		if (lastTotal !== costume.total) rank += 1;
		lastTotal = costume.total;
		costume.rank = rank;
	});

	return costumeVotes;
}
