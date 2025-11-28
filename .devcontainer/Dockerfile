FROM archlinux:base-devel

RUN pacman -Syu --noconfirm && \
    pacman -S --noconfirm --needed \
        webkit2gtk-4.1 \
        base-devel \
        curl \
        wget \
        file \
        openssl \
        appmenu-gtk-module \
        libappindicator-gtk3 \
        librsvg \
        lld \
        llvm \
        clang \
        xdotool \
        nodejs-lts-jod \
        npm \
        git \
        sudo \
        rustup \
        cargo \
        xdg-utils

# ユーザーを作成
RUN useradd -m -u 1000 vscode
# ユーザーに sudo 権限を付与 (必要に応じて)
RUN echo "vscode ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers
WORKDIR /home/vscode
USER vscode

RUN sudo npm install -g yarn
RUN rustup default stable && cargo install cargo-about

# install paru
RUN git clone https://aur.archlinux.org/paru.git && \
    cd paru && \
    makepkg -si --noconfirm
RUN paru -Sy --noconfirm nsis linuxdeploy-appimage

WORKDIR /workspace

CMD ["/bin/bash"]
