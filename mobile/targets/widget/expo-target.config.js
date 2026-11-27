/** Home Screen and Lock Screen widgets (ported from ios/Widgets). Built by EAS via @bacons/apple-targets. */
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: "widget",
  name: "ShadowWidgets",
  displayName: "Shadow Forum",
  icon: "../../assets/icon.png",
  colors: { $widgetBackground: "#06080f", $accent: "#2f7dff" },
  deploymentTarget: "17.0",
  entitlements: {
    // Same App Group as the app (added to the app by the expo-share-intent plugin) and src/lib/widget.ts.
    "com.apple.security.application-groups": ["group.com.talentedge.shadowforum"],
  },
});
