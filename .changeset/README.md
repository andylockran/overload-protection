# Changesets

This directory contains changeset files. Each changeset describes a change to the package, including the type of change (major, minor, or patch) and a description of the change.

## How to use

When you make a change to the package, create a new changeset file by running:

```bash
npx changeset
```

This will prompt you for:
1. The type of change (major, minor, or patch)
2. A summary of the change

The changeset file will be committed along with your changes. When a release is ready, the changesets will be processed to update the version and generate a changelog.

For more information, see the [Changesets documentation](https://github.com/changesets/changesets).
