export const createBackendApp = () => {
  return {
    start() {
      console.info("Backend service placeholder initialization.");
    },
  };
};

if (import.meta.url === `file://${process.argv[1]}`) {
  createBackendApp().start();
}
