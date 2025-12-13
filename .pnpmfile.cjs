module.exports = {
  hooks: {
    readPackage(packageJson) {
      if (packageJson?.optionalDependencies?.canvas) {
        delete packageJson.optionalDependencies.canvas;
      }

      return packageJson;
    },
  },
};
