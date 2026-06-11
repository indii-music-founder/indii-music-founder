function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
}
console.log(stripUndefined({
    a: 1,
    projectId: undefined,
    b: 'test'
}));
