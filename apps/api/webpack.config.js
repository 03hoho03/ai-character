const nodeExternals = require('webpack-node-externals');

/**
 * nest 기본 설정에 externals만 오버라이드:
 * node_modules는 external로 두되, workspace 패키지(@ai-character/*)는
 * TS 소스를 번들에 포함시킨다 (별도 빌드 단계 없이 직접 소비).
 */
module.exports = (options) => ({
  ...options,
  externals: [nodeExternals({ allowlist: [/^@ai-character\//] })],
});
