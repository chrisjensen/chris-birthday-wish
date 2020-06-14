# Chris's 40th Birthday Fundraiser

These are the supporting [custom components](components/) and [cloud functions](functions/) for my [40th birthday fundraiser](https://chris-birthday-wish.raisely.com/)

### How it works

The components were to support the following functionality:

1. Highest donor(s) chooses a song for me to dance to
2. All donors get to vote on costume for me to wear when dancing
3. Donations of $60 or more get to add an item of clothing to the voting

**Note:** If you visit the site you'll notice a lot of this functionality was not used. Just before I was to launch the fundraiser
the killing of George Floyd and all that followed happened. A campaign around a white guy dancing felt like it would be in poor taste
so I scaled this back down to a simple fundraiser. 

In the end, just two components were used:

1. [donate-expand](components/donate-expand/) - Doantion button that expands to a donation form to keep mobile layout uncluttered
2. [donation-profile](components/donation-profile) - Displays profile for each selected charity and calculates amount from general donations to display on the progress bar for each charity
