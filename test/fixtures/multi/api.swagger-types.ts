export default {
  output: 'lib/generated',
  prismaStyleNodeModulesOutput: false,
  schemas: [
    {
      name: 'services',
      source: './schemas',
      namespace: 'Services',
      format: 'auto'
    }
  ],
  generator: {
    emitOperations: true,
    emitSchemas: true,
    resolveRefs: true,
    naming: 'stable'
  }
};
