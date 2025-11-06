FROM mcr.microsoft.com/devcontainers/typescript-node:24

RUN echo "INSTALL GITHUB-ACTION DEVCONTAINER IMAGE" && \
    # Disable Bash's bracket paste mode
    echo "bind 'set enable-bracket-paste off'" >> ~/.bashrc && \
    # Allways show hidden files in ls and colorize the output
    echo "alias ls='ls -a --color=auto'" >> ~/.bashrc && \
    # Ensure that git reats /workspace as a safe directory to avoid permission-related issues.
    git config --global --add safe.directory /workspace