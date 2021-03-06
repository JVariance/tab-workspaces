# Grüße

Gruß geht raus an DD, den Babo, der dieses README vermutlich als Erster liest 👋🏼

# Tab Workspaces

This is a fork of [Workspaces](https://addons.mozilla.org/de/firefox/addon/tab-workspaces/) by @fonse

## Improvements:

 - Use of Firefox' hideTab-API --> Tabs are no longer closed and completely reloaded when adding or switching workspaces
 - Redesign -> Dark Theme added
 - Added sidebar (open with Ctrl+Alt+Q)
 - Shortcuts to add and switch workspaces

    - New Workspace: Ctrl+Alt+A
    - Switch to next Workspace: Ctrl+Alt+C
    - Switch to previuos Workspace: Ctrl+Alt+X

 - Send **multiple** (selected) tabs to new/ other workspace
 - Notification informs which workspace is active when switching (can be unchecked in extension's settings)

_______________________________________
Organize your tabs into workspaces. Switch between workspaces to change which tabs are displayed at the moment.

This extension aims to be an alternative to [Tab Groups](https://addons.mozilla.org/en-US/firefox/addon/tab-groups-panorama/), which is no longer supported as of Firefox 57.

## Features

 - Each tab belongs to a workspace. New tabs are automatically added to the current workspace.
 - Switch between workspaces from the toolbar icon to keep your tabs organized.
 - Tabs in other workspaces are safely hidden away.
 - Pinned tabs are visible from all workspaces.
 - If you have multiple windows open, each one has its own set of workspaces.
 - Send a specific tab to another workspace from the right-click menu.
 - Press Ctrl+Alt+W to open the list of workspaces, then press 1-9 to switch between using keyboard shortcuts.
 - Search through your tabs in the address bar. Type "ws [text]" to begin searching. Choose a result to switch to that tab.

## Acknowledgements

This extension was inspired by [Multi-Account Containers](https://addons.mozilla.org/en-US/firefox/addon/multi-account-containers/), which also served as a reference for some of the functionality.

Special thanks to [@NicolasJEngler](http://nicolasjengler.com.ar/) for designing a beautiful UI for this extension!

## Development

``` 

web-ext run --firefox=firefoxdeveloperedition
```

### Build

``` 

web-ext build --overwrite-dest
```

### Sass to CSS

``` 

sass --watch sass/sidebar.scss:views/sidebar/css/sidebar.css sass/popup.scss:views/popup/css/popup.css sass/options.scss:views/options/css/options.css sass/switched-workspace.scss:contentScripts/switched-workspace.css
```
