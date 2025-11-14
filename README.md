# Megatron Data Viewer

This repository contains a web-based viewer for visualizing Megatron simulation data.

It is built using React, and allows to interact with the data through a web interface without the need to install any software
on the webserver (apart from a static file server).

## Features
- 3D visualization of halo catalogues using [three.js](https://threejs.org/),
- Display of content of halo catalogues,
- Display of precomputed data (e.g., images and spectra),
- Interactive Python environment running in the browser using [Pyodide](https://pyodide.org/en/stable/) and [yt](https://yt-project.org/).

## Installation

In order to use the viewer, you need to have a working distribution of Python 3 and npm installed on your system.
We assume you have `uv` installed. If not, follow the instructions at https://docs.astral.sh/uv/getting-started/installation/#installation-methods.

## Cloning the repository
```bash
# Clone the repository
git clone https://github.com/cphyc/halo-viewer.git
cd halo-viewer

# Initialize submodules
git submodule update --init --recursive
```

## Building 'wheels'

The viewer includes a Python environment running in the browser. This allows
interacting with the cutouts (raw data products) using Python code.
It, however, requires two packages to be shipped as pre-compiled wheels:
`yt_derived_fields` and `yt_experiments`.

```bash
# Create wheels for yt_derived_fields
(
  cd external/yt_derived_fields
  uv build --wheel -o ../../../public/wheels/
)

# Create pyodide wheels for yt_experiments
(
  cd external/yt_experiments
  uvx cibuildwheel --platform pyodide
  cp wheelhouse/*.whl ../../../public/wheels/
)
```

## Building the web application

First, you'll need to create a local environment file, `.env.local`,
in the root of the repository. This file should contain the base URL
where your data is hosted.

```bash
# // File .env.local

# This is the base URL where the data is hosted. For example,
# if your data is hosted at https://example.com/data/,
# set BASE_URL to https://example.com/data/
BASE_URL=

# Don't change the line below unless you know what you're doing
VITE_DATA_BASE_URL=${BASE_URL}
```

Once this is done, you can build the application using npm:
```bash
# Install dependencies
npm install
# Build the application
npm run build
```

And voilà! Your application is ready to be deployed.

### Testing locally

You can test the application locally using
```bash
npm run dev
```

Alternatively, after you've built the application (see previous section), you can serve the local folder, e.g. with 
```bash
python -m http.server
```

Don't forget to modify the `.env.local` file to use the same port as the one used by the Python server (default is 8000).