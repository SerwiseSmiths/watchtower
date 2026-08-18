/** kebab-case/dot.case -> PascalCase, e.g. "subscription-plan" -> "SubscriptionPlan". */
export function pascalCase(input: string): string {
  return input
    .split(/[-_.]/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/** kebab-case -> camelCase, e.g. "subscription-plans" -> "subscriptionPlans". */
export function camelCase(input: string): string {
  const pascal = pascalCase(input);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function contentTypeGraphQLName(singularName: string): string {
  return pascalCase(singularName);
}

/** "blocks.hero-grid" -> "ComponentBlocksHeroGrid", matching Strapi's `__typename` convention for components. */
export function componentGraphQLName(componentUid: string): string {
  const [category, name] = componentUid.split('.');
  return `Component${pascalCase(category)}${pascalCase(name)}`;
}
