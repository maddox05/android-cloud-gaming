+++++++++++++++++
SUPABASE
+++++++++++++++++

in public schema
waitlist(user_id, time_joined, invite_code, code_used_to_join)
- user_id is the key, foreign key to auth.users.id
- time joined is used to track position in line
- invite_code is the user's code they are designated (this should be renamed to referral code for clarity)
- code_used_to_join is the code that someone used to join the waitlist\
RLS:
- enable delete for user on user_id
- enable insert for user on user_id
- enable read access for all users
small things to fix:
- have a way to redeem a code once you are on the waitlist
- make the use code box more visible on the join waitlist page
- people can quit and rejoin waitlist with the same code and it will boost their position multiple time
- don't have way of showing fake waitlist position

invite_codes(user_id, invite_code, time_redeemed, has_access)
- user_id and invite_code are the key
- user_id foreign key to auth.users.id
- invite_code has to be unique, this is also a uuid (we could make it the same as the user_id for simplicity)
- time-redeemed defaults to null, is when the code is redeemed
    - If you want, you coudld give remove access to people after one day or something
- has_access defaults to false, used to track if the code has been redeemed yet
RLS:
- Delete for authenticated users only
- Insert for authenticated users only
- Users can only view their data

+++++++++++++++++
FRONT END
+++++++++++++++++

New Pages:
          <Route path="/waitlist" element={<JoinWaitlist />} />
          <Route path="/waitlist/:userId" element={<Waitlist />} />
          <Route path="/redeem" element={<RedeemInvite />} />
          <Route path="/redeem/:inviteCode" element={<RedeemInvite />} />

/frontend/src/utils/waitlist_functions.ts
joinWaitlist(referralCode?)
- allows users to join the waitlist
- calls POST /api/join-waitlist

getWaitlistPosition(user_id)
- get user's current position in waitlist
    - fetches entry in waitlist table
    - counts users with earlier time_joined

isOnWaitlist(user_id)
- checks if a user is on the waitlist or not

getTotalWaitlistCount()
- counts the total number of users on the waitlist

getUserInviteCode(userId)
- get's a user's referral code

removeSelfFromWaitlist()
- allows users to remove themself from the waitlist
- security is from RLS

redeemInviteCode(inviteCode)
- redeems an invite code to give user access to the site
- calls POST /api/redeem-invite

/frontend/src/utils/supabase.ts
checkUserAccess()
- checks if the user has access to the platform via subscription or free access

+++++++++++++++++
BACK END
+++++++++++++++++

/signal/waitlist_endpoints.ts
WAITLIST_CONFIG
- adjust length of invite code and time bonuses for referrer and new user

generateInviteCode()
- generates a random 6 character alphanumeric referral code

joinWaitlist(token, referralCode?)
- verifies user's JWT token
- generates unique referral code
- If a referral code is provided
    - checks that it exists in waitlist table
    - prevents using your own referral code
    - records the code used to join
- creats entry in waitlist table
- if the referral was valid, rewards referrer by subtracting hours from time_joined

======ADMIN FUNCTIONS=======
** still need security I think?

generateInvites(count)
- Admin function to take the first count users off the waitlist
- for each user:
    - generates UUID invite code
    - inserts into invite_codes table
    - removes from waitlist

removeFromWaitlist(userId)
- admin function remove a user from the waitlist

adjustWaitlistPosition(userId, hoursToMove)
- admin function to manually adjust a user's waitlist position

/signal/invite_access.ts

checkAccess(token)
- checks if a user has platform access
- checks for stripe subscription (using pre-existing functions)
- checks for free access (see in auth.ts)

redeemInvite(token, inviteCode)
- redeems an invite code and grants user free access
- verifies JWT token
- looks up invite code in invite_codes table
- validates that code belongs to the user
- validates code hasn't been redeemed yet
- updates time_redeemed and has_access

/signal/auth.ts
checkFreeAccess(userId)
- checks if a user has redeemed an invite code
- checks invite_codes table for has_access = true

+++++++++++++++++
API END POINTS
+++++++++++++++++
GET /api/check-access
- check if a user has access (subscription or free)

POST /api/join-waitlist
- join waitlist with optional referral code

POST /api/redeem-invite
- redeem uuid invite code to gain platform access

POST /api/admin/generate-invites
- takes user off waitlist & generates invite codes

POST /api/admin/remove-from-waitlist
- remove a specific user from waitlist

POST /api/admin/adjust-position
- adjust a user's waitlist position


