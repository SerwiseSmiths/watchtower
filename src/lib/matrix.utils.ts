// Guideline sizes based on standard 1440x900 desktop viewport
const guidelineBaseWidth = 1440;
const guidelineBaseHeight = 900;

const getWidth = () =>
    typeof window !== 'undefined' ? window.innerWidth : guidelineBaseWidth;
const getHeight = () =>
    typeof window !== 'undefined' ? window.innerHeight : guidelineBaseHeight;

export const width = getWidth();
export const height = getHeight();

export const w = width;
export const h = height;

export const horizontalScale = (size: number) => (width / guidelineBaseWidth) * size;
export const verticalScale = (size: number) => (height / guidelineBaseHeight) * size;
export const moderateScale = (size: number, factor = 0.5) =>
    size + (horizontalScale(size) - size) * factor;

export const getDeviceHeightPercentage = (percentage: number) => (percentage / 100) * height;
export const getDeviceWidthPercentage = (percentage: number) => (percentage / 100) * width;

export const deviceType = width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';

export const hScaleFactor = width / guidelineBaseWidth;
export const vScaleFactor = height / guidelineBaseHeight;

const Metrics = {
    zero: 0,
    baseMargin: horizontalScale(10),
    doubleBaseMargin: horizontalScale(20),
    smallMargin: horizontalScale(5),
    textFieldRadius: 6,
    borderLineWidth: 1,
    screenWidth: width,
    screenHeight: height,
    buttonRadius: 4,
    icons: {
        tiny: horizontalScale(16),
        small: horizontalScale(20),
        medium: horizontalScale(30),
        large: horizontalScale(45),
        xl: horizontalScale(50),
    },
    images: {
        small: horizontalScale(20),
        medium: horizontalScale(40),
        large: horizontalScale(60),
        logo: horizontalScale(200),
    },
    size: {
        s: verticalScale(5),
        m: verticalScale(10),
        l: verticalScale(15),
        xl: verticalScale(20),
        xxl: verticalScale(25),
        xxxl: verticalScale(30),
    },
};

export { Metrics };
