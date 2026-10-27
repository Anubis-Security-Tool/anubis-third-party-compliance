# Original third-party notices and corresponding source

This package is a build-time data capsule, not a runtime library. Its files
retain their original licenses and copyright notices. No single umbrella
license replaces the MIT, LGPL or other licenses of the included material.

`manifest.json` binds every included data file to its byte length and SHA-256,
and identifies the exact registry version, source revision and original URL
used for each supplement. Build pipelines must copy the complete capsule
outside dependency-cleanup directories and verify those bytes in the final
distribution. Do not copy only filenames matching `LICENSE`.

The SPICE source archive is the unmodified preferred TypeScript source at the
published `spice-client@1.2.0` npm `gitHead`, including its build configuration
and dependency lock. Full GPLv3 and LGPLv3 texts accompany its original notice.
Other supplements preserve upstream original text, metadata and source
declarations where an npm package omitted the standalone document.

A package declaring MIT only in its original metadata is identified as such;
this capsule does not invent an upstream author, copyright date or missing
grant. Original metadata and README evidence are retained, together with the
standard MIT terms for reference. Such a declaration is different from an
upstream project with no license declaration at all.

## Rebuild or replace a library

Application source and build scripts are available from
<https://github.com/Anubis-Security-Tool/anubis> and
<https://github.com/Anubis-Security-Tool/anubis-web>. Use the exact source
revision identified by your distribution's provenance, not an unrelated
release or another machine's binary.

To modify SPICE, extract its source archive, install its locked development
dependencies, and build the library using its supplied build configuration.
Keep the original notices and the full license texts when redistributing it.
Point the applicable application's `spice-client` dependency at your compatible
modified library, update its dependency lock, and rebuild the application and
installer from source. Rebuild both Desktop and Web when modifying both
distributions. The application sources and installer-generation tools do not
require an Anubis private signing key.

Do not disable operating-system protection or substitute an unverified binary
to perform a rebuild. A replacement must remain interface-compatible with the
application; test your modified library and preserve the applicable source and
license information. The original source archive is supplied for rebuilding,
not executed or installed by this capsule.

## Maintenance

The source repository also retains `tools/refresh.cjs` for maintainers with
Node.js, GitHub CLI and access to the public source/registry endpoints. It
downloads original data and checks source-blob and registry identities; it
does not execute upstream package scripts. The preferred SPICE archive is
already tracked, with its exact upstream revision recorded in the manifest.
Changing dependency versions or regenerating an archive requires a new
reviewed capsule version and a new immutable publication. Never silently
replace a published capsule or manufacture a missing upstream attribution.
