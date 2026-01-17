# GitHub Copilot Agents

This directory contains specialized GitHub Copilot agent configurations for this repository.

## Available Agents

### e11e-simplify.md - Package Simplification Agent

**Purpose:** Helps simplify and modernize the overload-protection package according to e11e.dev (Eleven Elements) methodology and current Node.js best practices.

**When to use:**
- When reviewing the package for simplification opportunities
- Before major version releases to clean up technical debt
- When modernizing code to align with current ecosystem standards
- When reducing dependencies or improving maintainability

**How to use:**

1. **Via GitHub Copilot Chat:**
   Reference the agent in your conversation:
   ```
   @workspace Using the e11e-simplify agent guidelines, analyze this package and suggest simplifications
   ```

2. **Via GitHub Copilot Workspace:**
   The agent will automatically be available when working in this repository

3. **For manual review:**
   Simply read `.github/agents/e11e-simplify.md` to understand the eleven elements methodology

**What it covers:**

The e11e.dev methodology focuses on eleven key areas:

1. **Minimal Dependencies** - Reduce unnecessary external dependencies
2. **Modern JavaScript** - Use ES modules and modern syntax
3. **Clear Code Structure** - Simple, readable, maintainable code
4. **Focused Scope** - Do one thing well
5. **Explicit Configuration** - Clear configuration with good defaults
6. **Security First** - Follow security best practices
7. **Performance Conscious** - Optimize for production use
8. **Quality Testing** - Fast, reliable tests
9. **Clear Documentation** - Concise, accurate docs
10. **Ecosystem Alignment** - Follow Node.js standards
11. **Developer Experience** - Easy to use and contribute to

**Example workflow:**

```bash
# 1. Ask the agent for an analysis
# In GitHub Copilot Chat:
# "Using e11e-simplify agent, analyze our dependencies"

# 2. Review suggestions and create a plan

# 3. Implement changes incrementally

# 4. Validate after each change
npm test
npm run lint

# 5. Measure impact if needed
npm run benchmarks
```

**Important notes:**
- The agent is conservative and respects backward compatibility
- All suggestions should be validated with tests
- Performance impact should be measured for critical changes
- Breaking changes require strong justification

## Creating New Agents

To create a new agent for this repository:

1. Create a new `.md` file in this directory
2. Define the agent's role, expertise, and guidelines
3. Include specific context about this package
4. Document how to use the agent
5. Update this README with the new agent information

## Agent Best Practices

- **Be specific:** Agents should have clear, focused expertise
- **Provide context:** Include repository-specific knowledge
- **Define success:** Clear criteria for what "done" looks like
- **Stay updated:** Keep agents aligned with current project state
- **Test guidance:** Always include testing and validation steps

## Related Documentation

- [Copilot Instructions](../copilot-instructions.md) - General GitHub Copilot guidelines for this repo
- [README](../../readme.md) - Package documentation

## Feedback

If you have suggestions for improving existing agents or ideas for new agents, please:
1. Open an issue describing the agent need
2. Submit a PR with proposed changes
3. Discuss in PR reviews or team meetings
