when checking subscriptions we could do:
by supabase user id, get all of that users checkout sessions
we can check each of these users checkout sessions.
for each of these checkout sessiosn if completeded, check what subscription id they have then go to the subscriptions table and see if its a active subscription.

in that for loop if anything ever returns true we are chill
