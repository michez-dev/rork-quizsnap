import React, { memo, useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { QuestionImageRegion } from '@/types/quiz';
import Colors from '@/constants/colors';

interface QuestionImageProps {
  imageUri?: string;
  imageRegion?: QuestionImageRegion;
  style?: StyleProp<ViewStyle>;
  fallbackHeight?: number;
  testID?: string;
  contentFit?: 'contain' | 'cover';
}

function QuestionImageComponent({
  imageUri,
  imageRegion,
  style,
  fallbackHeight = 180,
  testID,
  contentFit = 'cover',
}: QuestionImageProps) {
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0 && Math.abs(nextWidth - containerWidth) > 1) {
      console.log('QuestionImage layout width updated:', nextWidth);
      setContainerWidth(nextWidth);
    }
  }, [containerWidth]);

  const cropMetrics = useMemo(() => {
    if (!imageRegion || containerWidth <= 0) {
      return null;
    }

    const sourceWidth = imageRegion.sourceWidth || 1;
    const sourceHeight = imageRegion.sourceHeight || 1;
    const cropWidthPx = sourceWidth * imageRegion.width;
    const cropHeightPx = sourceHeight * imageRegion.height;
    const cropAspectRatio = cropWidthPx > 0 ? cropHeightPx / cropWidthPx : 1;
    const resolvedHeight = containerWidth * cropAspectRatio;
    const renderedImageWidth = containerWidth / imageRegion.width;
    const renderedImageHeight = renderedImageWidth * (sourceHeight / sourceWidth);

    return {
      resolvedHeight,
      renderedImageWidth,
      renderedImageHeight,
      left: -imageRegion.x * renderedImageWidth,
      top: -imageRegion.y * renderedImageHeight,
    };
  }, [containerWidth, imageRegion]);

  if (!imageUri) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        style,
        cropMetrics ? { height: cropMetrics.resolvedHeight } : { height: fallbackHeight },
      ]}
      onLayout={handleLayout}
      testID={testID}
    >
      {cropMetrics ? (
        <Image
          source={{ uri: imageUri }}
          style={[
            styles.croppedImage,
            {
              width: cropMetrics.renderedImageWidth,
              height: cropMetrics.renderedImageHeight,
              left: cropMetrics.left,
              top: cropMetrics.top,
            },
          ]}
          contentFit="fill"
        />
      ) : (
        <Image
          source={{ uri: imageUri }}
          style={styles.fullImage}
          contentFit={contentFit}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    position: 'relative',
  },
  fullImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  croppedImage: {
    position: 'absolute',
  },
});

export default memo(QuestionImageComponent);
