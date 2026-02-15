const { override, addLessLoader, overrideDevServer } = require('customize-cra');

const devServerConfig = () => (config) => {
  config.client = {
    ...config.client,
    overlay: {
      ...(config.client?.overlay || {}),
      runtimeErrors: (error) => {
        if (
          error?.message ===
          'ResizeObserver loop completed with undelivered notifications.'
        ) {
          return false;
        }
        return true;
      },
    },
  };
  return config;
};

module.exports = {
  webpack: override(
    addLessLoader({
      lessOptions: {
        javascriptEnabled: true,
        modifyVars: { '@base-color': '#f44336' },
      },
    })
  ),
  devServer: overrideDevServer(devServerConfig()),
};