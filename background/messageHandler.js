browser.runtime.onMessage.addListener(async (m, sender, sendResponse) => {
  let response;

  console.log({ m });

  switch (m.method) {
    case "getWorkspacesForCurrentWindow":
      const workspaces = await BackgroundLogic.getWorkspacesForCurrentWindow();
      response = await Promise.all(workspaces.map(workspace => workspace.toObject()));
      break;

    case "switchToWorkspace":
      await BackgroundLogic.switchToWorkspace(m.workspaceId);
      break;

    case "createNewWorkspaceAndSwitch":
      const workspace = await BackgroundLogic.createNewWorkspaceAndSwitch();
      return workspace;
      break;

    case "renameWorkspace":
      await BackgroundLogic.renameWorkspace(m.workspaceId, m.workspaceName);
      break;

    case "deleteWorkspace":
      await BackgroundLogic.deleteWorkspace(m.workspaceId);
      break;
  }

  return response;
});
