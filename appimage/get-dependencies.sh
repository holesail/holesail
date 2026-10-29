#!/bin/sh

set -eu

ARCH=$(uname -m)

echo "Installing package dependencies..."
echo "---------------------------------------------------------------"
pacman -Syu --noconfirm --needed unzip wget

echo "Installing debloated packages..."
echo "---------------------------------------------------------------"
get-debloated-pkgs --add-common --prefer-nano

case "$ARCH" in
	x86_64) ASSET=linux-x64 ;;
	aarch64) ASSET=linux-arm64 ;;
	*)
		echo "Unsupported architecture: $ARCH"
		exit 1
		;;
esac

if [ -n "${HOLESAIL_BIN-}" ]; then
	# The release workflow already built the binary
	install -Dm755 "$HOLESAIL_BIN" /usr/bin/holesail
	VERSION=$(awk -F'"' '/"version"/{print $4; exit}' package.json)
else
	# The upstream Bare build is currently broken against the published
	# bare-module/libjstl/js.h releases, so use the binaries they ship instead
	VERSION=$(wget --spider -S "https://github.com/holesail/holesail/releases/latest" 2>&1 \
		| awk '/[Ll]ocation:/{print $2}' \
		| sed -n 's|.*/tag/||p' \
		| tail -n1 | tr -d '\r')

	if [ -z "$VERSION" ]; then
		echo "Failed to determine the latest version of holesail"
		exit 1
	fi

	echo "Downloading holesail $VERSION ($ASSET)..."
	echo "---------------------------------------------------------------"
	wget --retry-connrefused --tries=30 \
		"https://github.com/holesail/holesail/releases/download/${VERSION}/${ASSET}.zip" \
		-O ./holesail.zip
	unzip -o ./holesail.zip -d ./
	rm -f ./holesail.zip

	install -Dm755 ./holesail /usr/bin/holesail
	rm -f ./holesail
fi

echo "${VERSION#v}" > ~/version
