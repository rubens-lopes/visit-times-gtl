get you time spend by on a geo-coordinate using you json from Google timeline

download only your Location History JSON file at https://takeout.google.com/settings/takeout

on the `params.js` file fill thoses inputs:

|param|value|
|-|-|
|jsonFile|path to json file (no extension)|
|from|a moment object with the starting datetime|
|to|a moment object with the ending datetime|
|maxDist|the tolerable radius that we should considere a valid point (in meters)|
|maxDeltaTime|how much time must have spent between two records to be considered a visited point|
|pointOfInterest|the x,y geo-coordinate we are interested in|
