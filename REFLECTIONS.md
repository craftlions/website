# Reflections

## What Surprised Me

The `this` context in Astro's inline `<script>` tags doesn't refer to the DOM element you might expect. When attaching event listeners in module scripts, `this` inside arrow functions refers to the module scope, not the element. Web Components with Custom Elements solve this by providing a proper `this` context that refers to the custom element instance, making it predictable and useful for DOM traversal with `this.querySelector()`.

## One Pattern to Add

**Web Components for Encapsulated Client-Side Behavior**: Use Custom Elements (`customElements.define()`) for interactive components that need proper `this` context and encapsulation. This pattern provides:
- Predictable `this` context (refers to the element instance)
- Encapsulated logic that doesn't leak to global scope
- Reusability across pages without script duplication
- Lifecycle methods (`connectedCallback`, `disconnectedCallback`) for proper setup/teardown

## One Prompt Improvement

Be explicit about the `this` context issue or Web Component preference upfront. Instead of discovering the need during implementation, the prompt could specify: "Refactor to use a Web Component with Custom Elements to ensure `this` context properly refers to the element instance." This would avoid the intermediate step of creating a standard Astro component first.
