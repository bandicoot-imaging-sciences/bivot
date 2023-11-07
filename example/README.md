# Example app using Bivot React component

This is an example of how to use the Bivot React component.

To set up and run this example app (paths relative to the root of the checkout):

1. At top level run `pnpm install`
2. In `example` run `pnpm install`
3. Add a `textures` folder in `example/public` containing a Bivot textures folder layout (see the Bivot `README.md` for
   more details )
4. Edit `example/public/bivot-config.json` and `example/public/bivot-renders.json` to match your textures folder
5. In `example` run `pnpm start`

## Development

To use the example app to test local changes to Bivot without publishing a new Bivot package:

1. Run the example app in `example` using `pnpm start`
2. Change the Bivot code
3. At top level, run `pnpm run build`
4. After the build finishes, the example app should automatically refresh and pick up the changes
