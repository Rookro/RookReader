FROM ubuntu:24.04

# Delete ubuntu(uid: 1000) and add vscode user(uid: 1000).
RUN userdel -r ubuntu &&\
    useradd -m -u 1000 vscode

# Setup Tauri environment.
# https://v2.tauri.app/start/prerequisites/

# Install dependencies.
RUN apt-get update && apt-get install -y \
    libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    file \
    libxdo-dev \
    libssl-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    xdg-utils \
    git \
    fonts-noto-cjk \
    language-pack-ja-base \
    language-pack-ja \
    locales

# Generate Japanse locale.
RUN locale-gen ja_JP.UTF-8

# Install Node.js and yarn
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs &&\
    corepack enable yarn

USER vscode

# Setup Japanse ennvironment.
RUN echo "export LANG=ja_JP.UTF-8" >> ~/.bashrc &&\
    . ~/.bashrc

# Setup Rust.
RUN curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh -s -- -y &&\
    . "$HOME/.cargo/env" && \
    rustup default stable && \
    cargo install cargo-about
