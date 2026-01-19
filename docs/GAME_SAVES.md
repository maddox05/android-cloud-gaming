Users can now after this save thier games.

**Worker Logic Changes:**

Currently tmpfs or thier data diff on top of the golden redriod image is discarded on exit, and a new one is created each time

we now use a normal docker volume instead(todo limit it to 50MB for example)

worker will start. worker will stop the redriod container & worker will again delete the old volume if it exists

worker will call r2 with correct location and if it finds a vol, it will restore that volume into given and then start redriod

if not, it will auto create a new one as that is the default

user will play game, data will save to this new volume and redriod handles this

user exits

we stop the redriod container, extract the volume with the given changes if so, send it back to r2

we **DELETE THE VOLUME** and then the worker restarts itself

**notes**
volumes are not capped at some MB anymore, so a harmful user could do harmful things.
why send volumes through worker? why not just take from r2 directly and reduce costs?
