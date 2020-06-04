const _ = require('lodash');
const axios = require('axios');

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const RAISELY_TOKEN = process.env.RAISELY_TOKEN;
const RANKING_URL = process.env.RANKING_URL;

const CAMPAIGN_PATH = 'chris-birthday-wish';
const CAMPAIGN_UUID = '7c9a93c0-a314-11ea-85e8-014a76ec5878';
const RAISELY_API = 'https://api.raisely.com/v3'

module.exports = async function (context, req) {
	// Verify that the webhook is actually from raisely using the shared secret
	if (!authenticate(req)) {
		context.log.error('Unauthenticated request');
		context.res = {
			status: 403,
			body: {
				error: { message: 'Unauthorized request' }
			},
		}
		return;
	}

	const event = req.body.data;
	const donation = event.data;
	let addedClothing = false;

	const promises = [];

	// Get latest donor ranking
	// Bust the cache so it's up to date, which has the nice side effect of
	// keeping the message on the website always up to date

	// This isn't thread safe, but it's unlikely that donations will come in so fast
	// fast that this will be an issue
	// But to play safe, fire this off as our first request to minimise
	// the time that another donation could slip in
	promises.push(axios(`${RANKING_URL}?clearCache=1`));

	// Referencing amount rather than campaign amount as donors will be in
	// Singapore and Australia, and it's simpler if we offer the reward
	// for donating $60 rather than AUD 60 or SGD 58
	// Amounts are in cents
	if (donation.amount >= 6000) {
		promises.push(addClothingItem(context, donation));
	}

	try {
		// Wait for the config update and the latest donor list to complete
		const results = await Promise.all(promises);
		const [donorResponse] = results;
		addedClothing = results[1];

		const { donors } = donorResponse.data.data;

		const donorUuid = donation.user.uuid;
		const [topDonor, secondDonor] = donors;

		let emailPromises;

		// If this donor is top ranked and there has been more than one donor
		if ((topDonor.uuid === donorUuid) && secondDonor) {
			const leaderGap = topDonor.total - secondDonor.total;

			// If this donation was greater than the gap, then this donation
			// put them in the lead,
			if (donation.amount > leaderGap) {
				// Notify them that they're ahead
				emailPromises = [sendFirstPlaceEmail(context, { donation, leaderGap })];

				const secondPlace = donors
					.filter(d => d.total === secondDonor.total);

				emailPromises.push(sendSecondPlaceEmails(context, { donors: secondPlace, leaderGap }));

				await emailPromises;
				context.log(`Notified winner and runners up`);
			}
		}

		context.res = {
			status: 200,
			body: {
				addedClothing,
				rankingChanged: !!emailPromises,
			}
		}
	} catch (error) {
		context.log.error(error);
		context.res = {
			status: 500,
			body: JSON.stringify({
				error: { message: error.message }
			})
		}
	}
};

/**
 * Verify that the webhook came from raisely by checking the shared secret
 * If authentication fails, will set a 200 response
 * (to prevent Raisely from continuing to retry the webhook with a bad secret)
 * @param {*} req
 * @param {*} res
 * @returns {boolean} true if the request is authenticated
 */
function authenticate(req) {
	const secret = req.body.secret;

	return (secret && secret === WEBHOOK_SECRET);
}

async function sendFirstPlaceEmail(context, { donation, leaderGap }) {
	return sendEmail(context, {
		donor: donation,
		leaderGap,
		messageType: 'lead-gained',
	});
}

/**
 *
 * @param {*} context Request context
 * @param {object[]} opts.donors
 * @param {integer} opts.leaderGap The gap between first and second place totals
 */
async function sendSecondPlaceEmails(context, { donors, leaderGap }) {
	// The donor information is from a public facing function so it doesn't include emails
	// To send them a message, we're going to need to first fetch their full record containing emails
	const promises = donors.map(async (donor) => {
		const user = await axios(`${RAISELY_API}/users/${donor.uuid}`, {
			headers: { authorization: `bearer ${RAISELY_TOKEN}`},
		});
		return sendEmail(context, {
			donor: {
				...donor,
				..._.pick(user, ['email', 'preferredName', 'fullName']),
			},
			leaderGap,
			messageType: 'lead-lost',
		});
	});
	await Promise.all(promises);
}

/**
 *
 * @param {*} context Context of cloud function request
 * @param {object} opts.donor
 * @param {integer} opts.leaderGap
 * @param {string} opts.messageType
 */
async function sendEmail(context, { donor, leaderGap, messageType }) {
	const customEvent = axios('https://communications.raisely.com/v1/events', {
		headers: {
			authorization: { bearer: `raisely:${RAISELY_TOKEN}` },
		},
		method: 'POST',
		data: {
			data: {
				type: 'raisely.custom',
				source: `campaign:${CAMPAIGN_UUID}`,
				createdAt: new Date().toISOString(),
				version: 1,
				data: {
					...donor,
					// Convert gap to dollars, add $1
					// to get the amount to donate in order
					// to lead
					amountToLead: (leaderGap / 100) + 1,
					messageType,
				},
			},
		},
	});
	context.log(customEvent);
	return customEvent;
}

const pathify = (unsanitized) =>
	_.trim(unsanitized, '-')
		// remove non compatible characters
		.replace(/[^a-zA-Z0-9-]+/g, '')
		// remove consecutive slashes (prevents too many permutations)
		.replace(/[-]{2,}/g, '-')
		// then cast to lowercase
		.toLowerCase();

async function addClothingItem(context, donation) {
	const photoUrl = _.get(donation, 'public.pictureOfCostumeItem');
	const label = _.get(donation, 'public.clothing');
	const value = pathify(name);

	const newOption = { label, value, photoUrl };

	// Get existing field options
	const fields = await axios(`${RAISELY_API}/campaigns/${CAMPAIGN_PATH}/fields?private=true`);
	const costumeField = fields.find(f => f.name === 'costumeVote');

	if (!costumeField.options.find(option => option.value === newOption.value)) {
		context.log('Adding new costume option', newOption);
		costumeField.options.push(newOption);
		const newOptions = _.shuffle([...costumeField.options, newOption]);
		await axios(`${RAISELY_API}/fields/${costumeField.uuid}`, {
			method: 'PATCH',
			headers: { authorization: `bearer ${RAISELY_TOKEN}` },
			data: { data: { options: newOptions } },
		});

		return true;
	}
	return false;
}
