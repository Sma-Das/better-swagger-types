export default {
  output: 'lib/generated',
  prismaStyleNodeModulesOutput: false,
  schemas: [
    {
      name: 'core',
      source: './schemas/petstore.json',
      namespace: 'Core',
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
