Invite codes let people onto the side
You either need to pay or receive an invite code, that allows you to get on the website

Free users are on the waitlist to get into the site

Need to somehow calculate a position
- what time did I join
- Am I still on the waitlist (did I use a code and get off?)

** for now, show them that it pushes them back

waitlist table needs to be public

- we will have user_id be the key, and time joined will be the way we get ordering
- I think I am going to remove users when they get off / leave the waitlist

We can worry about sending the invite code later

(user_id, time joined, invite code, code used to join)

To get a users position:

SELECT user_id, position
FROM (
    SELECT A.user_id, COUNT(B.user_id) AS position
    FROM table A JOIN table B ON user_id
    WHERE B.timestamp < A.timestamp
    GROUP BY A.user_id
)
WHERE user_id = x

Changing a user's position:

