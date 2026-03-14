export default {
  output: 'lib/generated',
  prismaStyleNodeModulesOutput: false,
  schemas: [
    {
      name: 'simple',
      source: './schemas/simple.json',
      namespace: 'Simple',
      format: 'auto'
    }
  ],
  generator: {
    emitOperations: true,
    emitSchemas: true,
    emitSimpleAliases: true,
    resolveRefs: true,
    naming: 'stable'
  }
};
