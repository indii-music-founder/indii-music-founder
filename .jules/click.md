## 2025-05-23 - Slot Component Child Constraint
**Learning:** The `asChild` prop (using Radix UI `Slot`) fails with `React.Children.only` error if the component attempts to render multiple children (e.g. `{isLoading && <Loader />} {children}`), even if the conditional is false (rendering `false` + `Element`).
**Action:** When using `asChild`, explicitly pass ONLY `children` to the `Slot` component. Conditional content (like loaders) must be either omitted or handled differently (e.g. wrapper component) to preserve the single-child requirement.
