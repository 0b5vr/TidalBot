FROM phusion/baseimage:latest

# == define ENV_VARS ===========================================================
ENV LANG C.UTF-8
ENV HOME /root

# == install some packs ========================================================
# Ref: https://github.com/ikag/docker-images/blob/master/supercollider/Dockerfile
# Ref: https://github.com/lvm/tida1vm/blob/0.9/Dockerfile
# Ref: https://github.com/maxhawkins/sc_radio/blob/master/Dockerfile
RUN apt update
RUN apt -y upgrade
RUN DEBIAN_FRONTEND=noninteractive apt install -yq --no-install-recommends \
    sudo \
    supervisor \
    autoconf \
    automake \
    libtool \
    build-essential \
    libsndfile1-dev \
    icecast2 \
    darkice \
    libasound2-dev \
    libasound2-plugins \
    alsa-base \
    alsa-utils \
    libavahi-client-dev \
    libicu-dev \
    libreadline6-dev \
    libfftw3-dev \
    libxt-dev \
    libudev-dev \
    git \
    wget \
    ca-certificates \
    cmake \
    jackd2 \
    libjack-jackd2-dev \
    haskell-mode \
    zlib1g-dev \
    liblo7 \
    cabal-install \
    ghc

RUN curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
RUN sudo apt-get install -y nodejs
RUN apt clean

# == build supercollider =======================================================
# Ref: https://github.com/ikag/docker-images/blob/master/supercollider/Dockerfile
# Ref: https://github.com/supercollider/supercollider/wiki/Installing-SuperCollider-from-source-on-Ubuntu
# Ref: https://github.com/supercollider/sc3-plugins
WORKDIR $HOME
RUN git clone --recursive https://github.com/supercollider/supercollider.git
WORKDIR $HOME/supercollider
RUN git submodule update --init
RUN mkdir -p $HOME/supercollider/build
WORKDIR $HOME/supercollider/build
RUN cmake -DCMAKE_BUILD_TYPE="Release" -DBUILD_TESTING=OFF -DSUPERNOVA=OFF -DNATIVE=OFF -DSC_WII=OFF -DSC_QT=OFF -DSC_ED=OFF -DSC_EL=OFF -DSC_VIM=OFF ..
RUN make -j4 && make install
RUN ldconfig
WORKDIR $HOME/supercollider
RUN cp SCClassLibrary/Common/Core/Model.sc /usr/local/share/SuperCollider/SCClassLibrary/Common/Core/
RUN rm -f /usr/local/share/SuperCollider/SCClassLibrary/deprecated/3.7/deprecated-3.7.sc

WORKDIR $HOME
RUN git clone --recursive https://github.com/supercollider/sc3-plugins.git
WORKDIR $HOME/sc3-plugins
RUN git submodule update --init
RUN mkdir -p $HOME/sc3-plugins/build
WORKDIR $HOME/sc3-plugins/build
RUN cmake -DCMAKE_BUILD_TYPE="Release" -DSC_PATH=$HOME/supercollider ..
RUN cmake --build . --config Release --target install
WORKDIR $HOME
RUN rm -rf sc3-plugins supercollider

RUN echo 'include( "SuperDirt" );' | sclang

# == install tidal and modules =================================================
WORKDIR $HOME
RUN cabal update
RUN cabal install tidal

RUN git clone https://github.com/lvm/tidal-drum-patterns.git
WORKDIR $HOME/tidal-drum-patterns
RUN cabal clean && cabal configure && cabal build && cabal install
WORKDIR $HOME
RUN rm -rf tidal-drum-patterns

# == fetch ffmpeg (already built one!) =========================================
# Ref: https://qiita.com/flny/items/798547356dcc47239702
WORKDIR $HOME
RUN wget http://johnvansickle.com/ffmpeg/releases/ffmpeg-release-64bit-static.tar.xz
RUN tar Jxvf ./ffmpeg-release-64bit-static.tar.xz
RUN cp ./ffmpeg*64bit-static/ffmpeg /usr/local/bin/
RUN rm -rf ffmpeg*

# == setup node app ============================================================
WORKDIR $HOME/app
RUN npm install -g forever
RUN npm install discord.js node-opus fms-cat/node-jack-connector#master

# == send some files ===========================================================
ADD ./home $HOME

# == I think it's done =========================================================
WORKDIR $HOME
EXPOSE 8000
CMD supervisord -c supervisor.conf
