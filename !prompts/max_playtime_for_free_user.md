part 2 capping out a free users time:
i want to let free users play a max of FREE_USER_MAX_TIME_MS (store it in shared consts)

so when a free user joins main websocket "/" we will check if they have used up all ther time and send a disconnect with time used as reason msg back if so. (make sure to send after authenticated msg) we will use the database.ts function getUsertimetoday to check that.,

after regeting or accepting user the client will have a new class var, time used today.

this will now be used to check like with out interval checks, if the user this.time_used_today + current_session_time (calculated) >= FREE_USER_MAX_TIME_MS then send a disconnect as the reason: time used

cleint will need a new function checkIfTimeUsed and if user is paid it can instantly return
