the frontend will be as follows

a navbar with info

a list of games below it ( 1 for now clash royale) 

it is a icon and I can clcik play on it, when I click plays it teels the signlaing server hey I want to play coc royale

if it succeeds, it will open a new tab like domain/app/com.supercell.clashroyale

and this will finally connect the user to the webrtc stream (may need to make the stream connection global as you are going to another page, could also use url params)

so seperate the logic of these 2 pages, and have shared logic that they both need abstracted. abstract smartly code for simplicity, and make outer js files not having it embeeded in html files.

if the user goes to domain/app/com.supercell.clashroyale early when they didnt even click play on the game to connect to the signal server or a worker give them a js message that teels them then take them back home

anythign i did not mention but maybe is in the image can just be for show, and are no-ops

soon we will at some point add auth etc, so just make sure everything is setup simply and modular and clean, so I can make changes as needed.

use async functions and js functions not consts as functions. alr go crazy hoe!